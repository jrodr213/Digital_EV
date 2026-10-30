import math
from backend.components.catalog import REQUIRED, FIELDS


def assemble(vehicle, components):
    errors, warnings = [], []
    grouped = {}
    for c in components:
        grouped.setdefault(c['category'], []).append(c)
        if c.get('mass_kg') is None:
            errors.append(f'{c["name"]}: missing installed assembly mass [kg].')
    if vehicle.get('payload_kg') is None:
        errors.append('Passenger/cargo payload is unknown [kg]. Enter an explicit value, including zero for an unmanned test.')
    if vehicle.get('auxiliary_w') is None:
        errors.append('Auxiliary electrical load is unknown [W].')
    if len(vehicle['component_ids']) != len(set(vehicle['component_ids'])):
        errors.append('Duplicate components are not supported. Use an aggregate assembly part.')
    for category, fields in REQUIRED.items():
        parts = grouped.get(category, [])
        if len(parts) != 1:
            errors.append(f'Select exactly one {category} assembly; found {len(parts)}.')
            continue
        c = parts[0]
        for field in fields:
            val = c['specs'].get(field)
            if val is None:
                errors.append(f'{c["name"]}: missing {field} [{FIELDS[category][field]}].')
                continue
            elif field == 'regen':
                if not isinstance(val, bool): errors.append('regen must be true or false.')
            elif field == 'driven_wheels':
                if val not in ['FWD','RWD','AWD']: errors.append('driven_wheels must be FWD, RWD or AWD.')
            elif not isinstance(val, (int,float)) or isinstance(val, bool) or not math.isfinite(val):
                errors.append(f'{field} must be a finite number.')
            elif val < 0 or (val == 0 and field not in ['min_soc','charge_limit_a','rolling_resistance','cg_height_m','drag_coefficient','min_voltage_v']):
                errors.append(f'{field} must be positive (zero only where physically meaningful).')
            elif ('efficiency' in field or field in ['min_soc','max_soc','usable_fraction','drive_axle_weight_fraction']) and val > 1:
                errors.append(f'{field} must be a fraction <= 1.')
            expected = FIELDS[category][field]
            if expected not in ['text','boolean','JSON'] and c.get('units',{}).get(field) != expected:
                errors.append(f'{c["name"]}: {field} must declare canonical unit {expected}. Convert imported values explicitly.')
    known_mass = sum(c['mass_kg'] for c in components if c.get('mass_kg') is not None)
    mass_complete = all(c.get('mass_kg') is not None for c in components) and vehicle.get('payload_kg') is not None
    base = {'errors': errors, 'warnings': warnings, 'mass_kg': known_mass + vehicle['payload_kg'] if mass_complete else None, 'known_component_mass_kg': known_mass, 'mass_complete': mass_complete, 'components': components}
    if vehicle.get('custom_parameters', {}).get('document_project'):
        warnings.extend(['Document-sourced provisional assembly: listing claims, dimensions and component ratings require review.', 'Prices are historical planning allowances from the supplied documents, not verified supplier quotes. Kit, spare and off-vehicle items are tracked separately from installed assembly mass.'])
    if errors: return base
    p = {k: v[0]['specs'] for k,v in grouped.items() if k in REQUIRED}
    b,m,i,d,ch,t = (p[k] for k in REQUIRED)
    for field in ['series','parallel']:
        if b[field] != int(b[field]): errors.append(f'{field} must be an integer.')
    if t['num_wheels'] != 4: errors.append('This adapter supports four-wheel vehicles only.')
    if b['min_soc'] >= b['max_soc']: errors.append('min_soc must be below max_soc.')
    if b['cell_max_voltage_v'] < b['cell_voltage_v']: errors.append('Maximum cell voltage is below nominal voltage.')
    for part, lo, hi in [(b,'continuous_a','peak_a'),(m,'rated_power_kw','peak_power_kw'),(m,'rated_torque_nm','peak_torque_nm'),(i,'continuous_a','peak_a'),(i,'min_voltage_v','max_voltage_v'),(b,'bms_min_v','bms_max_v')]:
        if part[lo] > part[hi]: errors.append(f'{lo} exceeds {hi}.')
    voltage = b['cell_voltage_v'] * b['series']
    full_voltage = b['cell_max_voltage_v'] * b['series']
    if voltage < i['min_voltage_v'] or full_voltage > i['max_voltage_v']: errors.append('Battery nominal/full-charge voltage is outside inverter voltage limits.')
    if voltage < b['bms_min_v'] or full_voltage > b['bms_max_v']: errors.append('Battery voltage is outside supplied BMS limits.')
    current = min(b['continuous_a'],b['bms_continuous_a'],i['continuous_a'])
    power = min(m['rated_power_kw'],i['max_power_kw']*m['efficiency']*i['efficiency'],max(0,voltage*current/1000-vehicle['auxiliary_w']/1000)*m['efficiency']*i['efficiency'])
    if power <= 0: errors.append('Auxiliary demand exhausts the available continuous electrical power.')
    if m['rated_power_kw']*1000 > m['rated_torque_nm']*m['max_rpm']*2*math.pi/60:
        errors.append('Rated motor power cannot be reached within supplied continuous torque and maximum RPM.')
    if b.get('min_temp_c') is not None and b.get('max_temp_c') is not None:
        try:
            if b['min_temp_c'] >= b['max_temp_c']: errors.append('Battery minimum temperature must be below maximum temperature.')
        except TypeError: errors.append('Battery temperature limits must be numeric.')
    if voltage*b['continuous_a']/1000 < m['rated_power_kw']/m['efficiency']/i['efficiency'] + vehicle['auxiliary_w']/1000:
        warnings.append('Battery continuous current capability is below rated motor + auxiliary demand; simulation is power-limited.')
    if m['peak_power_kw'] > i['max_power_kw']*m['efficiency']*i['efficiency']: warnings.append('Motor peak mechanical power exceeds inverter capability after conversion losses.')
    if m['max_rpm'] > d['max_input_rpm']: warnings.append('Motor maximum RPM exceeds drivetrain input rating; analytical speed is capped.')
    if m['peak_torque_nm'] > d['max_torque_nm']: warnings.append('Motor peak torque exceeds drivetrain input torque rating.')
    if not i['regen']: errors.append('Regen-disabled builds are unsupported by this FASTSim BEV adapter. No simulation will be substituted.')
    if m.get('efficiency_map'): errors.append('Torque/RPM efficiency maps are stored but not supported by this scalar-efficiency adapter. Remove the map only after explicitly choosing a scalar approximation.')
    if abs(b['charge_efficiency']-b['discharge_efficiency']) > 1e-9: errors.append('FASTSim Constant battery efficiency is symmetric; this adapter requires equal charge/discharge efficiencies.')
    if b['usable_fraction'] > b['max_soc']-b['min_soc']+1e-8: errors.append('Usable fraction exceeds the supplied SOC window.')
    warnings.extend(['Continuous ratings govern FASTSim; peak duration is unknown.', 'No thermal, structural, handling or braking validation. Cooling descriptions are metadata.', 'Nominal-voltage current estimates omit voltage sag, cell imbalance and internal-resistance dynamics.', 'FASTSim scalar power model does not enforce motor torque, gearing or RPM. Review analytical limit flags.'])
    if any(c.get('hypothetical') for c in components): warnings.append('Contains hypothetical demonstration parts. These are not manufacturer specifications.')
    base.update(specs=p, nominal_voltage_v=voltage, full_voltage_v=full_voltage, nominal_energy_kwh=voltage*b['capacity_ah']*b['parallel']/1000, usable_energy_kwh=voltage*b['capacity_ah']*b['parallel']/1000*b['usable_fraction'], mechanical_power_kw=power, battery_power_kw=voltage*min(b['continuous_a'],b['bms_continuous_a'])/1000, effective_efficiency=m['efficiency']*i['efficiency']*d['efficiency'], wheel_torque_nm=min(m['rated_torque_nm'],d['max_torque_nm'])*d['gear_ratio']*d['efficiency'])
    return base
