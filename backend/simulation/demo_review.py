"""Explain demo outcomes using only that run's saved inputs and traces."""
import math

from backend.simulation.analytical import MPS_PER_MPH


def build_demo_review(result):
    if not result.get('request', {}).get('demo_mode'):
        return None
    assembly = result['assembly']
    analytical = result['analytical']
    summary = result['summary']
    request = result['request']
    specs = assembly['specs']
    battery, motor, inverter, drive, tires = (
        specs[key] for key in ['battery', 'motor', 'inverter', 'drivetrain', 'tires'])
    samples = result.get('samples', [])
    assumptions = result.get('demo_assumptions', assembly.get('demo_assumptions', []))
    direct = drive.get('drive_type') == 'direct' and drive['gear_ratio'] == 1
    findings = []

    def finding(id, title, status, evidence, impact, improvement):
        findings.append(dict(id=id, title=title, status=status, evidence=evidence,
                             impact=impact, improvement=improvement))

    radius = drive['wheel_diameter_m'] / 2
    rolling_force = assembly['mass_kg'] * 9.80665 * tires['rolling_resistance']
    chassis = specs['chassis']
    traction = tires['friction_coefficient'] * assembly['mass_kg'] * 9.80665 * (
        1 if drive['driven_wheels'] == 'AWD' else chassis['drive_axle_weight_fraction'])
    torque_force = assembly['wheel_torque_nm'] / radius
    torque_limited = torque_force <= traction
    wheel_force = analytical.get('starting_wheel_force_n')
    if wheel_force is None:
        wheel_force = min(torque_force, traction)
    can_start = wheel_force > rolling_force
    motor_parts = [p for p in assembly.get('components', []) if p['category'] == 'motor']
    motor_count = motor_parts[0].get('custom_parameters', {}).get('installed_quantity') if len(motor_parts) == 1 else None
    if not isinstance(motor_count, (int, float)) or isinstance(motor_count, bool) or not math.isfinite(motor_count) or motor_count <= 0:
        motor_count = None
    required_wheel_torque = rolling_force * radius
    balance_motor_torque = required_wheel_torque / (drive['gear_ratio'] * drive['efficiency'])
    per_motor = f' ({balance_motor_torque / motor_count:.2f} N m per motor for {motor_count:g} motors sharing the load equally)' if motor_count else ''
    if not can_start:
        deficit = rolling_force - wheel_force
        finding(
            'launch', ('Torque' if torque_limited else 'Traction') + ' shortfall in the assumed configuration', 'shortfall',
            f'Available starting wheel force is {wheel_force:.1f} N versus {rolling_force:.1f} N of level-road rolling resistance '
            f'at {assembly["mass_kg"]:.1f} kg. The force shortfall is {deficit:.1f} N. '
            f'The wheels need {required_wheel_torque:.2f} N m combined just to balance rolling resistance; '
            f'the motor/drivetrain can supply {assembly["wheel_torque_nm"]:.2f} N m before the tire-grip limit. '
            + (f'Tire grip caps force at {traction:.1f} N even though motor torque could provide {torque_force:.1f} N.' if not torque_limited else ''),
            'The analytical model predicts no launch on level ground. '
            + ('A moving FASTSim trace can still appear because its scalar motor model does not enforce this torque limit. '
               if torque_limited else 'Here tire grip limits starting force even before the available motor torque is exhausted. ')
            + 'Range and consumption from the power-flow trace remain conditional.',
            (f'First replace assumed low-speed motor torque, wheel diameter, mass and rolling resistance with measurements. '
            f'The modeled rolling-balance threshold is {balance_motor_torque:.2f} N m aggregate motor torque{per_motor}; '
            'acceleration and hills require more. '
            + ('Keep the 1:1 wheel connections while comparing lower-payload tests or smaller wheel diameters; each changes other requirements and needs a fresh run.'
               if direct else 'Compare mass, wheel size and available motor torque using separately labeled scenarios.'))
            if torque_limited else
            'Verify tire friction, the load carried by the driven wheels and rolling resistance. '
            'Compare representative surfaces and load distributions while keeping the selected drive layout. '
            'More motor torque alone does not remove a tire-grip limit.')
    else:
        finding(
            'launch', 'Level-road launch has modeled torque margin', 'observed',
            f'Available starting wheel force is {wheel_force:.1f} N versus {rolling_force:.1f} N of rolling resistance '
            f'at {assembly["mass_kg"]:.1f} kg, a margin of {wheel_force - rolling_force:.1f} N.',
            'This clears the modeled level-road rolling load. It does not establish launch acceleration, loaded hill starts, '
            'shaft strength or measured tire grip.',
            'Check measured low-speed torque and rolling force, then repeat with the intended passenger/cargo mass and a separate hill test.')

    rated_kw = motor['rated_power_kw']
    available_kw = assembly['mechanical_power_kw']
    voltage = assembly['nominal_voltage_v']
    continuous_a = min(battery['continuous_a'], battery['bms_continuous_a'], inverter['continuous_a'])
    conversion = motor['efficiency'] * inverter['efficiency']
    required_a = (rated_kw * 1000 / conversion + assembly['auxiliary_w']) / voltage
    power_limited = available_kw < rated_kw * .99
    finding(
        'power', 'Electrical supply limits usable motor power' if power_limited else 'Continuous power budget',
        'shortfall' if power_limited else 'observed',
        f'The motor assembly is modeled at {rated_kw:.2f} kW continuous. Available mechanical power is {available_kw:.3f} kW '
        f'({available_kw / rated_kw * 100:.0f}% of that rating). Inputs include {voltage:.1f} V, a {continuous_a:.1f} A '
        f'battery/BMS/drive continuous-current ceiling, {assembly["auxiliary_w"]:.0f} W of auxiliary demand and '
        f'{conversion * 100:.0f}% combined motor/drive efficiency.',
        f'At these assumed efficiencies, supplying the full modeled motor rating plus auxiliaries would require about {required_a:.1f} A '
        f'at nominal voltage. FASTSim also caps battery power by the charge limit, currently {battery["charge_limit_a"]:.1f} A, '
        'because this adapter uses symmetric charge/discharge power. A listed maximum BMS current does not establish continuous or charge capability.',
        'Confirm continuous battery/BMS and custom power-stage ratings, charge acceptance and auxiliary draw. '
        'Replace the demo allowances with reviewed limits before interpreting a power increase; a larger battery capacity alone does not fix a current or torque limit.')

    duration = samples[-1]['time_s'] - samples[0]['time_s'] if len(samples) > 1 else 0.
    max_target = max((s['target_mph'] for s in samples), default=0.)
    max_speed = max((s['speed_mph'] for s in samples), default=0.)
    max_error = max((abs(s['target_mph'] - s['speed_mph']) for s in samples), default=0.)
    has_miss = max_error * MPS_PER_MPH > .1
    missed_s = sum(
        max(0., current['time_s'] - previous['time_s'])
        for previous, current in zip(samples, samples[1:])
        if abs(current['speed_mph'] - current['target_mph']) * MPS_PER_MPH > .1)
    missed_fraction = missed_s / duration if duration > 0 else 0.
    finding(
        'trace', 'Requested speed was not fully achieved' if has_miss else 'The requested speed trace was followed',
        'shortfall' if has_miss else 'observed',
        f'The {duration:.0f} s trace requests up to {max_target:.1f} mph and achieves up to {max_speed:.1f} mph. '
        f'Time outside the 0.1 m/s speed tolerance is {missed_s:.1f} s ({missed_fraction * 100:.1f}%); '
        f'the largest speed difference is {max_error:.1f} mph.',
        ('The requested schedule exceeds what this power-flow model achieved. Consumption is calculated over achieved distance, not requested distance.'
         if has_miss else 'Following this trace only describes this run. It does not clear the separate torque, mounting, structural or electrical unknowns.'),
        'Use a low-speed acceleration and stopping trace first, then compare added payload and longer duty cycles. '
        'Keep achieved speed beside requested speed when comparing results.')

    if request.get('test') == 'hill':
        grade = analytical['hill_grade'] * 100
        target = analytical['hill_target_mph']
        wheel_kw = available_kw * drive['efficiency']
        finding(
            'hill', 'Hill target exceeds modeled capability' if not analytical['hill_can_maintain'] else 'Hill target clears the steady-load check',
            'shortfall' if not analytical['hill_can_maintain'] else 'observed',
            f'At {grade:.1f}% grade and {target:.1f} mph, the steady-load estimate requires '
            f'{analytical["hill_required_force_n"]:.1f} N and {analytical["hill_required_wheel_kw"]:.3f} kW at the wheels. '
            f'Available continuous wheel power is {wheel_kw:.3f} kW. The torque, traction and RPM checks '
            + ('do not all pass.' if not analytical['hill_can_maintain'] else 'pass for this steady-load calculation.'),
            'A steady hill calculation is separate from starting on a hill. The native trace may still violate motor torque limits, '
            'and there is no model of heat buildup during a sustained climb.',
            'Retest lower hill speeds and representative payloads, then compare with measured low-speed torque and a recorded temperature/duty test.')

    projected = summary.get('range_miles')
    range_text = f'The repeated-cycle range projection is {projected:.1f} miles.' if projected is not None else 'No positive range projection is available from this trace.'
    finding(
        'range', 'Range is an extrapolation from a short test' if duration < 600 or summary['distance_miles'] < 1 else 'Range remains a repeated-cycle projection', 'uncertain',
        f'This run covers {summary["distance_miles"]:.3f} miles in {duration:.0f} s and consumes '
        f'{summary["energy_kwh"] * 1000:.1f} Wh. Modeled battery energy is '
        f'{assembly["nominal_energy_kwh"] * 1000:.0f} Wh nominal / {assembly["usable_energy_kwh"] * 1000:.0f} Wh usable. {range_text}',
        ('The launch shortfall makes this power-flow range conditional even before considering test length. ' if not can_start else '')
        + 'Repeating these exact conditions is not the same as a measured full-discharge trip. Voltage sag, battery aging, '
        'temperature effects and changing road conditions are excluded.',
        'After resolving launch and supply limits, run a longer representative low-speed route with starts, stops and intended payload. '
        'Compare measured energy per mile and usable pack energy with the model before increasing capacity to address range.')

    mass_assumptions = [item for item in assumptions if item['field'] == 'mass_kg']
    assumed_mass = sum(item['value'] for item in mass_assumptions)
    finding(
        'inputs', 'Important inputs still need measurement' if assumptions else 'No missing inputs were filled', 'uncertain',
        f'{len(assumptions)} inputs were assigned for this demo. '
        f'{len(mass_assumptions)} installed mass allowances total {assumed_mass:.1f} kg; '
        'the ledger also identifies any assumed payload, motor ratings, efficiencies, wheel dimensions, current limits and rolling resistance.',
        'A small change in these inputs can change whether direct drive can launch, maintain speed or finish a hill. '
        'A precise-looking result is not a confidence interval; no statistical uncertainty analysis is performed.',
        'Prioritize weighing the assembled vehicle, measuring the fitted wheel diameter and establishing motor torque versus RPM. '
        'Then replace assumed electrical limits and auxiliary draw. Rerun the same test after each change so its effect is visible.')
    regen_assumed = any(item['field'] == 'regen' for item in assumptions)
    finding(
        'hardware', 'Mounting, frame and control behavior remain untested', 'uncertain',
        ('Regeneration is a demo-only assumption. ' if regen_assumed else '')
        + f'The trace reports {summary.get("regen_kwh", 0) * 1000:.2f} Wh of recovered terminal energy. '
        + ('The saved layout uses two independent direct wheel connections at 1:1. ' if direct else '')
        + 'The model contains no wheel-bearing/shaft load, frame/joint stress, steering, braking-control or custom circuit dynamics.',
        'The demo cannot tell whether the steel/PVC arrangement carries the intended loads, whether motor shafts support the wheels, '
        'or whether the custom ESP32 power stage operates correctly. Regenerated energy does not prove hardware support.',
        ('Keep the same materials and direct-drive layout while defining wheel support, couplings, retention and mounting details. ' if direct else '')
        + 'Review those details separately, establish the control and braking behavior, and confirm battery/drive charge support before relying on regen.')

    shortfalls = [item for item in findings if item['status'] == 'shortfall']
    findings.sort(key=lambda item: {'shortfall': 0, 'uncertain': 1, 'observed': 2}[item['status']])
    return {
        'version': 1,
        'title': 'Demo shortfalls & room for improvement',
        'headline': ('Resolve launch torque before relying on the range estimate.' if torque_limited else
                     'Resolve the tire-grip shortfall before relying on the range estimate.') if not can_start else
                    'Review the detected limits before increasing the test demands.' if shortfalls else
                    'This run clears its modeled checks; key inputs still need verification.',
        'overview': (
            'FASTSim produced a power-flow result, while the separate analytical model predicts that this configuration cannot start on level ground. '
            'That disagreement is the main shortfall: the moving trace is conditional, not proof that the current build can move.'
            if not can_start else
            'The analytical model predicts enough wheel force for level-road launch. The findings below distinguish the achieved trace, '
            'remaining modeled limits and the inputs or physical behavior that the demo does not verify.'),
        'layout_note': (
            'Improvement ideas below retain your two-wheel direct drive and 1:1 wheel connections. No gears, shared drive axle, belts or chains are added.'
            if direct else 'These findings use this run’s saved drivetrain configuration; they do not change your selected parts.'),
        'assumption_count': len(assumptions),
        'shortfall_count': len(shortfalls),
        'findings': findings,
        'next_steps': [
            {'title': 'Replace the inputs that control launch', 'detail': 'Measure assembled mass and wheel diameter, establish the motor torque/RPM curve, and measure level rolling force with the intended payload.'},
            {'title': 'Establish the continuous electrical budget', 'detail': 'Confirm battery/BMS and custom drive current limits, auxiliary draw and charge acceptance; distinguish continuous ratings from seller maximum claims.'},
            {'title': 'Repeat comparable tests', 'detail': 'Rerun the same gentle cycle after each input update, then compare low-speed acceleration, intended payload, a separate hill test and a longer duty cycle. Treat changes as scenarios until measured.'},
            {'title': 'Check what the simulation leaves out', 'detail': 'Assess wheel supports, motor shafts, frame joints, braking/steering behavior and circuit operation separately. Compare instrumented prototype data with the model once those details are established.'},
        ],
        'basis': 'Generated from this run’s saved assembly, assumption ledger and achieved/requested samples. No live library edits or new engine run are used.',
    }


def with_demo_review(result):
    """Enrich old demo results on read without rewriting stored history."""
    if not result.get('request', {}).get('demo_mode') or result.get('demo_review'):
        return result
    return {**result, 'demo_review': build_demo_review(result)}


def review_markdown(review):
    lines = [f'## {review["title"]}', '', f'**{review["headline"]}**', '', review['overview'], '', review['layout_note'], '']
    statuses = {'shortfall': 'Modeled shortfall', 'uncertain': 'Needs verification', 'observed': 'Observed in this run'}
    for item in review['findings']:
        lines += [f'### {item["title"]}', '', f'**{statuses[item["status"]]}**', '', item['evidence'], '',
                  f'**What this means:** {item["impact"]}', '', f'**Room for improvement:** {item["improvement"]}', '']
    lines += ['### Suggested order of work', '']
    for i, item in enumerate(review['next_steps'], 1):
        lines += [f'{i}. **{item["title"]}.** {item["detail"]}']
    lines += ['', review['basis'], '']
    return '\n'.join(lines) + '\n'
