import type {Part, Vehicle} from '../types';

export const STEP = 1 / 60;
export const G = 9.80665;
export const MPS_PER_MPH = .44704;
const TAU = Math.PI * 2;

export type DriveParameters = {
  dryMass: number; payload: number; powerW: number; torqueNm: number; maxRpm: number;
  motorVoltage: number; motorEfficiency: number; controllerEfficiency: number;
  controllerA: number; controllerW: number; batteryV: number; capacityAh: number;
  batteryA: number; batteryEfficiency: number; minSoc: number; maxSoc: number;
  auxiliaryW: number; stallLossW: number; ratio: number; driveEfficiency: number;
  radius: number; length: number; width: number; wheelbase: number; track: number;
  cgHeight: number; rearWeight: number; grip: number; rolling: number; inertia: number;
  dragArea: number; steerDeg: number; steerRate: number; brakeNm: number;
  travel: number; springK: number; dampingC: number;
};
export type ParameterKey = keyof DriveParameters;
export type Assumptions = Partial<DriveParameters>&{driven?:'FWD'|'RWD'|'AWD'};
export type Parameter = {key: ParameterKey; label: string; value: number; unit: string; assumed: boolean; basis: string; min: number; max: number};
export type DriveConfig = {
  vehicle: Vehicle; parts: Part[]; p: DriveParameters; parameters: Parameter[];
  motorCount: number; driven: 'FWD'|'RWD'|'AWD'; mass: number; errors: string[]; notes: string[];
  shaftTorque: number; shaftPowerW: number; rpmLimit: number; capacityWh: number;
  socFloor: number;
};

// Assembly mass and canonical rated motor power/torque already include installed
// quantity in this application's contract. Only per-motor listing claims multiply.
export function resolveDriveConfig(vehicle: Vehicle, parts: Part[], overrides: Assumptions = {}): DriveConfig {
  const find = (category: string) => parts.find(p => p.category === category);
  const motor = find('motor'), battery = find('battery'), controller = find('inverter');
  const drive = find('drivetrain'), chassis = find('chassis'), tires = find('tires');
  const parameters: Parameter[] = [], errors: string[] = [], notes: string[] = [];
  const value = (part: Part|undefined, field: string, unit?: string): number|undefined => {
    const n = part?.specs[field];
    if (n == null) return;
    if (typeof n !== 'number' || !Number.isFinite(n) || (unit && part?.units[field] !== unit)) {
      notes.push(`${part?.name}: ${field} has no usable canonical ${unit ?? 'numeric'} value; using an editable assumption.`);
      return;
    }
    return n;
  };
  const choose = (key: ParameterKey, label: string, unit: string, saved: number|undefined, fallback: number, basis: string, min = 0, max = 1e6) => {
    const assumed = saved === undefined, n = assumed ? overrides[key] ?? fallback : saved;
    if (!Number.isFinite(n) || n < min || n > max) errors.push(`${label} must be between ${min} and ${max} ${unit}.`);
    parameters.push({key, label, unit, value: n, assumed, basis: assumed ? basis : 'Selected saved configuration / canonical units', min, max});
    return n;
  };
  for (const category of ['motor', 'battery', 'drivetrain', 'chassis']) {
    if (parts.filter(p => p.category === category).length !== 1) errors.push(`Select exactly one ${category} assembly in Vehicle Builder.`);
  }
  for (const part of parts) if (part.mass_kg != null && (!Number.isFinite(part.mass_kg) || part.mass_kg < 0)) errors.push(`${part.name}: installed mass must be finite and nonnegative.`);
  const wheelCount=value(tires,'num_wheels','count');
  if(wheelCount!=null&&wheelCount!==4)errors.push('The driving adapter supports exactly four wheels.');
  const quantity = motor?.custom_parameters.installed_quantity ?? 1;
  const motorCount = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
  if (motorCount !== quantity) errors.push('Motor quantity must be a positive integer.');
  const knownMass = parts.reduce((sum, part) => sum + (part.mass_kg ?? 0), 0);
  const massComplete = parts.every(part => part.mass_kg != null && Number.isFinite(part.mass_kg));
  const dryMass = choose('dryMass', 'Installed vehicle mass (without people)', 'kg', massComplete ? knownMass : undefined, Math.max(180, knownMass), `${parts.filter(p => p.mass_kg == null).length} installed groups have unknown mass. Total dry-mass assumption includes ${knownMass.toFixed(1)} kg known mass.`, .1, 10000);
  if (dryMass < knownMass) errors.push('Assumed dry mass cannot be below the sum of known installed masses.');
  const payload = choose('payload', 'Driver, passengers and cargo', 'kg', vehicle.payload_kg ?? undefined, 75, 'Temporary rider/cargo mass; not written to the builder.', 0, 2000);
  const motorEfficiency = choose('motorEfficiency', 'Motor conversion efficiency', 'fraction', value(motor, 'efficiency', 'fraction'), .85, 'Scalar efficiency; no measured torque/RPM efficiency map.', .05, 1);
  const listedW = value(motor, 'listed_power_per_motor_w', 'W') ?? value(motor, 'listed_power_w', 'W');
  const powerW = choose('powerW', 'Aggregate mechanical motor power', 'W', mul(value(motor, 'rated_power_kw', 'kW'), 1000), listedW != null ? listedW * motorCount * motorEfficiency : 1000, 'Listing wattage has unknown duty and electrical/mechanical basis. Default assumes electrical input × motor efficiency; edit after measurement.', 1, 1e6);
  const torqueNm = choose('torqueNm', 'Aggregate continuous motor torque', 'N m', value(motor, 'rated_torque_nm', 'N m'), 15 * motorCount, 'Illustrative 15 N m per motor low-speed torque; NOT inferred from listing power.', .01, 10000);
  const maxRpm = choose('maxRpm', 'Motor maximum speed', 'rpm', value(motor, 'max_rpm', 'rpm'), 3000, 'Illustrative speed limit; seller operating speed is not a maximum rating.', 1, 100000);
  const batteryV = choose('batteryV', 'Nominal battery voltage', 'V', product(value(battery, 'cell_voltage_v', 'V'), value(battery, 'series', 'count')) ?? value(battery, 'listed_nominal_voltage_v', 'V'), 36, 'Nominal bus-voltage assumption.', 1, 1500);
  const motorVoltage = choose('motorVoltage', 'Motor rated bus voltage', 'V', value(motor, 'listed_voltage_v', 'V') ?? value(motor, 'nominal_voltage_v', 'V'), batteryV, 'Assume selected motor matches the nominal pack voltage.', 1, 1500);
  const capacityAh = choose('capacityAh', 'Pack capacity', 'Ah', product(value(battery, 'capacity_ah', 'Ah'), value(battery, 'parallel', 'count')) ?? value(battery, 'listed_capacity_ah', 'Ah'), 15, 'Nominal pack capacity assumption.', .01, 10000);
  const batteryA = choose('batteryA', 'Battery continuous discharge limit', 'A', minimum(value(battery, 'continuous_a', 'A'), value(battery, 'bms_continuous_a', 'A')), 25, 'Continuous limit unknown. A listed maximum BMS current is only a ceiling, not a continuous rating.', .01, 10000);
  const controllerA = choose('controllerA', 'Aggregate controller DC current limit', 'A', value(controller, 'continuous_a', 'A'), 25, 'Total bus current shared by all motors; not phase current or per-controller current.', .01, 10000);
  const controllerW = choose('controllerW', 'Aggregate controller electrical power limit', 'W', mul(value(controller, 'max_power_kw', 'kW'), 1000), batteryV * controllerA, 'Total controller input power assumption.', 1, 1e7);
  const controllerEfficiency = choose('controllerEfficiency', 'Controller efficiency', 'fraction', value(controller, 'efficiency', 'fraction'), .95, 'Scalar power-stage efficiency.', .05, 1);
  const batteryEfficiency = choose('batteryEfficiency', 'Battery discharge efficiency', 'fraction', value(battery, 'discharge_efficiency', 'fraction'), .97, 'Stored-energy to terminal-energy efficiency.', .05, 1);
  const minSoc = choose('minSoc', 'Minimum usable SOC', 'fraction', value(battery, 'min_soc', 'fraction'), .1, 'Illustrative discharge cutoff.', 0, .99);
  const usable = value(battery, 'usable_fraction', 'fraction');
  if(usable!=null&&(usable<=0||usable>1))errors.push('Battery usable fraction must be greater than zero and at most one.');
  const maxSoc = choose('maxSoc', 'Starting SOC', 'fraction', value(battery, 'max_soc', 'fraction'), Math.min(1, minSoc + (usable ?? .8)), 'Illustrative starting state; not a measured battery state.', .01, 1);
  if (maxSoc <= minSoc) errors.push('Starting SOC must exceed minimum usable SOC.');
  const socFloor=Math.max(minSoc,maxSoc-(usable??1));
  if(socFloor>minSoc)notes.push(`Saved usable fraction further limits discharge to ${(socFloor*100).toFixed(1)}% SOC.`);
  const auxiliaryW = choose('auxiliaryW', 'Auxiliary electrical load', 'W', vehicle.auxiliary_w ?? undefined, 30, 'Controls, sensors and other auxiliary load.', 0, 100000);
  const stallLossW = choose('stallLossW', 'Aggregate full-torque copper / stall loss', 'W', value(motor, 'stall_loss_w', 'W'), powerW * .1, 'Additional torque-squared electrical loss. Scalar efficiency alone gives zero loss at stall.', 0, 1e6);
  const toothRatio = (() => { const rear = find('rear_sprockets'), front = find('motor_sprockets'); return divide(value(rear, 'tooth_count', 'count'), value(front, 'tooth_count', 'count')); })();
  const ratio = choose('ratio', 'Total motor-to-wheel reduction', 'ratio', value(drive, 'gear_ratio', 'ratio') ?? toothRatio, 5, 'Fixed total reduction. Canonical gear_ratio already includes sprockets; never multiply twice.', .01, 1000);
  const driveEfficiency = choose('driveEfficiency', 'Drivetrain efficiency', 'fraction', value(drive, 'efficiency', 'fraction'), .92, 'Mechanical losses applied once to wheel torque, after motor/controller conversion.', .05, 1);
  const radius = choose('radius', 'Wheel rolling radius', 'm', mul(value(drive, 'wheel_diameter_m', 'm') ?? value(tires, 'wheel_diameter_m', 'm'), .5) ?? value(tires, 'radius_m', 'm'), .28, 'Effective rolling radius, including tire.', .05, 2);
  const length = choose('length', 'Chassis length', 'm', value(chassis, 'length_m', 'm'), 3.2, 'Explorer concept dimensions are illustrative.', .5, 15);
  const width = choose('width', 'Chassis width', 'm', value(chassis, 'width_m', 'm'), 1.5, 'Explorer concept dimensions are illustrative.', .3, 4);
  const wheelbase = choose('wheelbase', 'Wheelbase', 'm', value(chassis, 'wheelbase_m', 'm'), 2.1, 'Front-to-rear axle distance.', .3, 10);
  const track = choose('track', 'Track width', 'm', value(chassis, 'track_m', 'm'), 1.4, 'Left-to-right wheel center distance.', .3, 4);
  if (wheelbase > length) errors.push('Wheelbase cannot exceed chassis length.');
  const cgHeight = choose('cgHeight', 'Center of mass above road', 'm', value(chassis, 'cg_height_m', 'm'), .48, 'Approximate combined vehicle/payload center of mass.', .1, 3);
  const driveWeight = value(chassis, 'drive_axle_weight_fraction', 'fraction');
  const drivenSaved = drive?.specs.driven_wheels;
  const driven = ['RWD', 'FWD', 'AWD'].includes(drivenSaved) ? drivenSaved as DriveConfig['driven'] : overrides.driven??'RWD';
  if (!drivenSaved) notes.push(`Driven-wheel assignment unknown: temporary ${driven} assumption, editable in engineering setup. Set drivetrain.driven_wheels in Component Library to persist it.`);
  if (drivenSaved && !['RWD', 'FWD', 'AWD'].includes(drivenSaved)) errors.push('Driven wheels must be FWD, RWD or AWD.');
  const rearWeight = choose('rearWeight', 'Static rear axle weight fraction', 'fraction', driveWeight == null || driven === 'AWD' ? value(chassis, 'rear_weight_fraction', 'fraction') : driven === 'FWD' ? 1 - driveWeight : driveWeight, .55, 'Approximate longitudinal center of mass; total mass is unchanged.', .1, .9);
  const grip = choose('grip', 'Tire friction coefficient', 'coefficient', value(tires, 'friction_coefficient', 'dimensionless'), .85, 'Uncalibrated tire coefficient; environment contact friction also contributes.', .02, 2);
  const rolling = choose('rolling', 'Rolling resistance coefficient', 'coefficient', value(tires, 'rolling_resistance', 'dimensionless'), .015, 'Constant Crr × normal load; separate from Ecctrl viscous wheel drag.', 0, .2);
  const inertia = choose('inertia', 'Inertia per wheel', 'kg m2', value(tires, 'wheel_inertia_kgm2', 'kg m2'), .25, 'Equivalent solid-cylinder wheel inertia; does not add a second copy of wheel mass.', .001, 100);
  const dragArea = choose('dragArea', 'Aerodynamic Cd × frontal area', 'm2', product(value(chassis, 'drag_coefficient', 'dimensionless'), value(chassis, 'frontal_area_m2', 'm2')), .7, 'Scalar drag area; air density 1.225 kg/m³.', 0, 15);
  const steering = find('steering'), suspension = find('suspension');
  const steerDeg = choose('steerDeg', 'Maximum wheel steer angle', 'deg', value(steering, 'max_steer_angle_deg', 'deg') ?? (value(steering, 'turning_radius_m', 'm') ? Math.atan(wheelbase / value(steering, 'turning_radius_m', 'm')!) * 180 / Math.PI : undefined), 30, 'Parallel front-wheel steering approximates Ackermann; turning radius ≈ wheelbase / tan(angle).', 1, 55);
  const steerRate = choose('steerRate', 'Steering angular rate', 'rad/s', value(steering, 'steer_rate_rad_s', 'rad/s'), 1.8, 'Illustrative steering actuator rate.', .1, 10);
  const brakeNm = choose('brakeNm', 'Brake torque per wheel', 'N m', value(find('brakes'), 'max_torque_per_wheel_nm', 'N m'), 180, 'Four friction brakes; no energy recovery. Brake hardware is unverified.', 1, 10000);
  const travel = choose('travel', 'Suspension cast travel', 'm', value(suspension, 'travel_m', 'm'), .22, 'Independent spring contact approximation; not a linkage model.', .08, .8);
  const mass = dryMass + payload;
  const springK = choose('springK', 'Spring stiffness per wheel', 'N/m', value(suspension, 'spring_k_n_m', 'N/m'), mass * G / (4 * travel * .32), 'Static compression ≈ 32% of travel at equal corner loading.', 100, 1e6);
  const dampingC = choose('dampingC', 'Damper coefficient per wheel', 'N s/m', value(suspension, 'damping_c_ns_m', 'N s/m'), 2 * .75 * Math.sqrt(springK * mass / 4), '75% of critical damping using quarter-car sprung mass.', 1, 1e5);
  const p: DriveParameters = {dryMass,payload,powerW,torqueNm,maxRpm,motorVoltage,motorEfficiency,controllerEfficiency,controllerA,controllerW,batteryV,capacityAh,batteryA,batteryEfficiency,minSoc,maxSoc,auxiliaryW,stallLossW,ratio,driveEfficiency,radius,length,width,wheelbase,track,cgHeight,rearWeight,grip,rolling,inertia,dragArea,steerDeg,steerRate,brakeNm,travel,springK,dampingC};
  const bmsMaximum = value(battery, 'listed_bms_max_discharge_a', 'A');
  const batteryLimit = Math.min(batteryA, bmsMaximum ?? Infinity);
  const terminalW = Math.max(0, Math.min(batteryV * Math.min(batteryLimit,controllerA),controllerW) - auxiliaryW - stallLossW);
  const voltageScale = Math.min(1,batteryV/motorVoltage);
  const controllerMinV=value(controller,'min_voltage_v','V'),controllerMaxV=value(controller,'max_voltage_v','V');
  if((controllerMinV!=null&&batteryV<controllerMinV)||(controllerMaxV!=null&&batteryV>controllerMaxV))errors.push('Nominal pack voltage is outside the saved controller voltage range.');
  if (voltageScale < .99) notes.push('Motor voltage exceeds pack voltage. RPM and mechanical power are conservatively scaled by pack/rated voltage; this is an uncalibrated approximation.');
  const phaseA = value(controller, 'phase_continuous_a', 'A'), kt = value(motor, 'torque_constant_nm_per_a', 'N m/A');
  const shaftTorque = Math.min(torqueNm, value(drive, 'max_torque_nm', 'N m') ?? Infinity, phaseA != null && kt != null ? phaseA * kt * motorCount : Infinity);
  const shaftPowerW = Math.min(powerW * voltageScale, terminalW * motorEfficiency * controllerEfficiency);
  const rpmLimit = Math.min(maxRpm * voltageScale,value(drive,'max_input_rpm','rpm') ?? Infinity);
  if (shaftPowerW <= 0) errors.push('Auxiliary and stall losses exhaust the available electrical power.');
  if (motor?.specs.efficiency_map) notes.push('A stored efficiency map is present; this real-time adapter uses the explicit scalar approximation shown here.');
  notes.push('Listing claims are not measured specifications. This simulation is uncalibrated; FASTSim saved tests remain independent.');
  return {vehicle,parts,p,parameters,motorCount,driven,mass,errors,notes,shaftTorque,shaftPowerW,rpmLimit,capacityWh:batteryV*capacityAh,socFloor};
}

function mul(a:number|undefined,b:number){return a == null ? undefined : a*b;}
function product(a:number|undefined,b:number|undefined){return a == null || b == null ? undefined : a*b;}
function divide(a:number|undefined,b:number|undefined){return a == null || b == null || b <= 0 ? undefined : a/b;}
function minimum(...values:(number|undefined)[]){const finite=values.filter((v):v is number=>v!=null);return finite.length ? Math.min(...finite) : undefined;}

export function torqueAtRpm(config: DriveConfig, rpm: number) {
  if (Math.abs(rpm) >= config.rpmLimit) return 0;
  const taper = Math.min(1, Math.max(0,(1-Math.abs(rpm)/config.rpmLimit)/.03));
  return Math.min(config.shaftTorque,config.shaftPowerW/Math.max(Math.abs(rpm)*TAU/60,1e-9))*taper;
}

// Ecctrl's horsepower is a torque normalization, NOT the actual EV power rating:
// Tmax = hp * 7022 / maxRPM. Efficiency is applied here once; Ecctrl applies ratio.
export function ecctrlCarConfig(config: DriveConfig) {
  const {p}=config;
  return {
    engineHorsepower:config.shaftTorque*p.driveEfficiency*config.rpmLimit/7022,
    engineMaxRPM:config.rpmLimit,gearRatios:[p.ratio],finalDriveRatio:1,
    transmissionMode:'manual' as const,reverseTorqueScale:1,reverseRPMScale:1,
    steerRate:p.steerRate,maxSteerAngle:p.steerDeg*Math.PI/180,
    engineTorqueCurveData:{samples:1024,points:Array.from({length:201},(_,i)=>({x:i/200,y:torqueAtRpm(config,config.rpmLimit*i/200)/config.shaftTorque,r_in:0,r_out:0}))},
    steerAngleCurveData:{points:[{x:0,y:1,r_out:0},{x:1,y:.5,r_in:0}]},
  };
}

export function wheelRpm(speedMps:number,radius:number){return speedMps/radius*60/TAU;}
export function climbingForce(mass:number,grade:number){return mass*G*Math.sin(Math.atan(grade));}
export function tractionLimit(mass:number,mu:number,axleFraction=1){return mass*G*mu*axleFraction;}
export function roadResistance(config:DriveConfig,speed:number,normalFraction=1){
  return config.mass*G*config.p.rolling*normalFraction + .5*1.225*config.p.dragArea*speed*speed;
}
export function electricalPower(config:DriveConfig,shaftW:number,torqueFraction:number){
  return Math.max(0,shaftW)/(config.p.motorEfficiency*config.p.controllerEfficiency) + config.p.stallLossW*Math.min(1,Math.abs(torqueFraction))**2 + config.p.auxiliaryW;
}
export function advanceEnergy(config:DriveConfig,energyWh:number,terminalW:number,dt:number){
  const maxWh=(config.p.maxSoc-config.socFloor)*config.capacityWh;
  const used=Math.min(maxWh,Math.max(0,energyWh)+Math.max(0,terminalW)*dt/3600/config.p.batteryEfficiency);
  return {energyWh:used,soc:Math.max(config.socFloor,config.p.maxSoc-used/config.capacityWh)};
}
