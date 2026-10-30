"""Unvalidated quasi-static longitudinal extension, separate from FASTSim."""
import math

MPS_PER_MPH = 0.44704
METERS_PER_MILE = 1609.344


def estimates(a, grade=0, target_mph=30):
    p = a['specs']; d,m,ch,t = (p[k] for k in ['drivetrain','motor','chassis','tires'])
    mass = a['mass_kg']; radius = d['wheel_diameter_m']/2
    wheel_w = a['mechanical_power_kw']*1000*d['efficiency']
    rpm_speed = min(m['max_rpm'],d['max_input_rpm'])*2*math.pi/60*radius/d['gear_ratio']
    def force(speed, slope=0):
        theta = math.atan(slope)
        return mass*9.80665*(math.sin(theta)+t['rolling_resistance']*math.cos(theta)) + .5*1.225*ch['drag_coefficient']*ch['frontal_area_m2']*speed**2
    lo,hi=0.,150.
    for _ in range(70):
        mid=(lo+hi)/2
        if force(mid)*mid > wheel_w: hi=mid
        else: lo=mid
    power_speed=(lo+hi)/2
    target=target_mph*MPS_PER_MPH
    req=force(target,grade)
    static_traction=t['friction_coefficient']*mass*9.80665*math.cos(math.atan(grade))*(1 if d['driven_wheels']=='AWD' else ch['drive_axle_weight_fraction'])
    wheel_force=min(a['wheel_torque_nm']/radius, wheel_w/target,static_traction)
    starting_force=min(a['wheel_torque_nm']/radius,t['friction_coefficient']*mass*9.80665*(1 if d['driven_wheels']=='AWD' else ch['drive_axle_weight_fraction']))
    can_start=starting_force>force(0)
    aero=.5*1.225*ch['drag_coefficient']*ch['frontal_area_m2']
    torque_speed=math.sqrt(max(0.,starting_force-force(0))/aero) if aero>0 else (150. if can_start else 0.)
    speed_limits={'RPM/gearing':rpm_speed,'continuous power':power_speed,'continuous torque / traction':torque_speed}
    limiting_factor=min(speed_limits,key=speed_limits.get)
    v=0.; times={30:None,60:None}
    for step in range(1,12001):
        traction=t['friction_coefficient']*mass*9.80665*(1 if d['driven_wheels']=='AWD' else ch['drive_axle_weight_fraction'])
        f=min(a['wheel_torque_nm']/radius,wheel_w/max(v,.1),traction)-force(v)
        v=min(max(v+f/mass*.01,0),rpm_speed)
        for mph in times:
            if times[mph] is None and v >= mph*MPS_PER_MPH: times[mph]=round(step*.01,2)
    return {'model':'analytical quasi-static; unvalidated','air_density_kgm3':1.225,'top_speed_mph':min(speed_limits.values())/MPS_PER_MPH,'rpm_limit_mph':rpm_speed/MPS_PER_MPH,'power_limit_mph':power_speed/MPS_PER_MPH,'torque_limit_mph':torque_speed/MPS_PER_MPH,'limiting_factor':limiting_factor,'can_start':can_start,'starting_wheel_force_n':starting_force,'rolling_force_n':force(0),'zero_30_s':times[30],'zero_60_s':times[60],'hill_required_force_n':req,'hill_required_wheel_kw':req*target/1000,'hill_can_maintain':bool(req<=wheel_force and target<=rpm_speed),'hill_grade':grade,'hill_target_mph':target_mph}
