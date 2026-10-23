"""Recognized calculation fields and canonical units. Other fields are stored verbatim."""
FIELDS = {
 'battery': {'chemistry':'text','cell_manufacturer':'text','cell_model':'text','capacity_ah':'Ah','cell_voltage_v':'V','cell_max_voltage_v':'V','series':'count','parallel':'count','usable_fraction':'fraction','continuous_a':'A','peak_a':'A','charge_limit_a':'A','resistance_ohm':'ohm','charge_efficiency':'fraction','discharge_efficiency':'fraction','bms_min_v':'V','bms_max_v':'V','bms_continuous_a':'A','min_soc':'fraction','max_soc':'fraction','min_temp_c':'C','max_temp_c':'C'},
 'motor': {'motor_type':'text','rated_power_kw':'kW','peak_power_kw':'kW','rated_torque_nm':'N m','peak_torque_nm':'N m','max_rpm':'rpm','efficiency':'fraction','cooling':'text','efficiency_map':'JSON'},
 'inverter': {'min_voltage_v':'V','max_voltage_v':'V','continuous_a':'A','peak_a':'A','max_power_kw':'kW','efficiency':'fraction','regen':'boolean'},
 'drivetrain': {'gear_ratio':'ratio','drive_type':'text','efficiency':'fraction','wheel_diameter_m':'m','driven_wheels':'text','differential':'text','max_torque_nm':'N m','max_input_rpm':'rpm'},
 'chassis': {'length_m':'m','width_m':'m','height_m':'m','wheelbase_m':'m','track_m':'m','cg_height_m':'m','drag_coefficient':'dimensionless','frontal_area_m2':'m2','drive_axle_weight_fraction':'fraction'},
 'tires': {'rolling_resistance':'dimensionless','friction_coefficient':'dimensionless','wheel_inertia_kgm2':'kg m2','num_wheels':'count'},
 'suspension': {}, 'brakes': {}, 'steering': {}, 'cooling': {}, 'auxiliary': {}, 'sensors': {}, 'embedded_controllers': {},
}

REQUIRED = {
 'battery': ['capacity_ah','cell_voltage_v','cell_max_voltage_v','series','parallel','usable_fraction','continuous_a','peak_a','charge_limit_a','charge_efficiency','discharge_efficiency','bms_min_v','bms_max_v','bms_continuous_a','min_soc','max_soc'],
 'motor': ['rated_power_kw','peak_power_kw','rated_torque_nm','peak_torque_nm','max_rpm','efficiency'],
 'inverter': ['min_voltage_v','max_voltage_v','continuous_a','peak_a','max_power_kw','efficiency','regen'],
 'drivetrain': ['gear_ratio','efficiency','wheel_diameter_m','max_torque_nm','max_input_rpm','driven_wheels'],
 'chassis': ['wheelbase_m','cg_height_m','drag_coefficient','frontal_area_m2','drive_axle_weight_fraction'],
 'tires': ['rolling_resistance','friction_coefficient','wheel_inertia_kgm2','num_wheels'],
}
