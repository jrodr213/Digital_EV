"""Reviewed transcription of the three supplied parts documents.

No supplier pages were used to fill missing ratings. Documents are evidence,
not executable instructions. Re-running writes JSON, not the live database.
"""
import json
from pathlib import Path
from backend.schemas.entities import Component, Vehicle

ROOT = Path(__file__).resolve().parents[1]
BUDGET = 'Budgeting options .docx'
GROUP3 = 'Parts List - Group 3 10_22_26.docx'
GROUP4 = 'Group4_Parts_List.xlsx'
parts = []


def add(key, name, category, *, source, location, specs=None, units=None,
        price=None, link='', manufacturer='', model='', notes='', **meta):
    part = Component(
        id='team-' + key, name=name, category=category, manufacturer=manufacturer,
        model=model, mass_kg=None, price=price, datasheet=link, hypothetical=False,
        specs=specs or {}, units=units or {}, notes=notes,
        custom_parameters={
            'document_project': 'team-parts-2026-10-22',
            'source_references': [{'document': source, 'location': location}],
            'verification_status': 'document claim only; manufacturer datasheet not verified',
            'part_status': 'candidate', 'currency': 'USD', **meta,
        },
    ).model_dump()
    parts.append(part)
    return part['id']


def build():
    parts.clear()
    motor = add('motor-budget', 'Provisional traction motor / eBay 256877952903', 'motor',
        source=GROUP3, location='Wheel Motors, final eBay option; also Budgeting options motor choices',
        specs={'listed_voltage_v': 48, 'listed_power_w': 2000}, units={'listed_voltage_v': 'V', 'listed_power_w': 'W'},
        price=100, link='https://www.ebay.com/itm/256877952903',
        notes='Selected only as the budget-preferred provisional option. The document does not establish continuous/peak power, torque, RPM, efficiency, motor mass or whether a controller is included.',
        price_basis='Budgeting options: about $100 per motor; allowance, not a quote',
        document_price_claims=[{'document': BUDGET, 'value_usd': 100, 'qualifier': 'about'}, {'document': GROUP3, 'text': '$99 ($94?)'}],
        installed_quantity=1, part_status='provisional selection')
    add('motor-kunray', 'Alternative / KUNRAY MY1020 / 1000–1600 W variants', 'motor',
        source=GROUP3, location='Wheel Motors, first option', manufacturer='KUNRAY', model='MY1020 (variant unresolved)',
        specs={'listed_voltage_range_v': [36,48], 'listed_power_range_w': [1000,1600]}, units={'listed_voltage_range_v':'V','listed_power_range_w':'W'},
        price=116, link='https://cnkunray.com/products/kunray-my1020-high-speed-brushless-motor-36v-48v-1000w-1500w-1600w-for-electric-scooter-go-karts-motorcycle-motor-ebike-conversion-kit?VariantsId=12356',
        notes='Catalog range spans variants. No exact voltage/power pairing or duty rating chosen.', price_basis='Group 3 listed price')
    add('motor-2000-42a', 'Alternative / 48 V, 2000 W listing / eBay 366657347716', 'motor',
        source=GROUP3, location='Wheel Motors, second option',
        specs={'listed_voltage_v':48,'listed_power_w':2000,'listed_current_a':42},
        units={'listed_voltage_v':'V','listed_power_w':'W','listed_current_a':'A'},
        price=94.16, link='https://www.ebay.com/itm/366657347716',
        notes='Document says rated for 42 A but does not identify phase versus DC or continuous versus peak current. Do not map to inverter or battery current.',
        shipping_allowance_usd=85, price_basis='Group 3: $94.16 plus $85 shipping')
    add('motor-vevor-1800', 'Alternative / VEVOR 48 V, 1800 W motor kit', 'motor',
        source=GROUP3, location='Wheel Motors, third option', manufacturer='VEVOR',
        specs={'listed_voltage_v':48,'listed_power_w':1800},units={'listed_voltage_v':'V','listed_power_w':'W'},
        price=119, link='https://www.vevor.com/brushless-dc-motor-c_11227/48v-1800w-electric-brushless-dc-motor-kit-with-controller-foot-pedal-throttle-p_010397677266',
        notes='Linked kit title mentions controller/throttle. Electrical limits and installed content are unverified.',price_basis='Group 3 listed price')
    add('motor-vevor-2000', 'Alternative / VEVOR 48 V, 2000 W, 4300 rpm kit', 'motor',
        source=GROUP3, location='Wheel Motors, VEVOR 2000 W option and its embedded hyperlinks', manufacturer='VEVOR',
        specs={'listed_voltage_v':48,'listed_power_w':2000,'listed_speed_rpm':4300},units={'listed_voltage_v':'V','listed_power_w':'W','listed_speed_rpm':'rpm'},
        price=116,link='https://www.ebay.com/itm/286452810794',
        notes='4300 rpm is a listing speed, not established as a maximum RPM. Kit controller limits are unknown.',
        alternative_reference='https://www.vevor.com/brushless-dc-motor-c_11227/2000w-electric-brushless-dc-motor-kit-48v-4300rpm-motor-with-speed-controller-p_010866619255',price_basis='Group 3 listed price')
    steering = add('steering-budget','Provisional steering gearmotor / AliExpress 3256806630223349','steering',
        source=BUDGET,location='Steering motor paragraph; also Group 3 AliExpress option',price=47,
        link='https://www.aliexpress.us/item/3256806630223349.html',
        notes='Steer-by-wire is a proposed topology only. Exact variant, voltage, torque, current, feedback, ratio and actuation limits are missing. The optional racing wheel/pedals mentioned in the budget document are not assumed available.',
        price_basis='Budget document: about $47',part_status='provisional selection',installed_quantity=1)
    for key,name,model,price,link in [
        ('steering-ion','Saturn ION steering assist motor','Saturn ION application',89,'https://www.ebay.com/itm/405052778126'),
        ('steering-cobalt','Chevy Cobalt steering assist motor','Chevy Cobalt application',100,'https://www.ebay.com/itm/147580227817'),
        ('steering-dorman','Dorman 905-050 assist motor/module','905-050',80,'https://www.walmart.com/ip/18874267249'),
        ('steering-stepperonline','StepperOnline brushed gearmotor option','PB84-84242200-G43',None,'https://www.omc-stepperonline.com/brushed-24v-dc-gear-motor-20nm-2832-23oz-in-51rpm-w-43-1-planetary-gearbox-ip66-155-c-311-f-pb84-84242200-g43')]:
        add(key,'Alternative / '+name,'steering',source=GROUP3,location='Steering Motor options',price=price,link=link,model=model,
            manufacturer='Dorman' if key=='steering-dorman' else '',notes='Alternative only. URL product descriptors have not been promoted to verified engineering specifications.',price_basis='Group 3 listed price' if price else 'Not supplied')
    fan = add('fan-budget','Provisional circuitry cooling fan / eBay 336510135781','cooling',
        source=BUDGET,location='Cooling fan paragraph; also Group 3 Fan Motor final option',price=25,
        specs={'listed_voltage_v':12},units={'listed_voltage_v':'V'},link='https://www.ebay.com/itm/336510135781',
        notes='Budget calls for one fan (~$25); Group 3 describes a two-fan 12-inch listing at $26.60. Package contents, installed quantity, current, dimensions and airflow need review.',
        price_basis='Budgeting options: about $25 allowance',installed_quantity=None,
        document_price_claims=[{'document':BUDGET,'value_usd':25,'quantity_text':'one fan'}, {'document':GROUP3,'value_usd':26.60,'quantity_text':'2x 12-inch'}],part_status='provisional selection')
    add('fan-amazon','Alternative / 12 V, 1800 rpm, 6-inch fan','cooling',source=GROUP3,location='Fan Motor, first option',price=30,
        link='https://www.amazon.com/dp/B074QG3CJS',specs={'listed_voltage_v':12,'listed_speed_rpm':1800,'listed_diameter_in':6},units={'listed_voltage_v':'V','listed_speed_rpm':'rpm','listed_diameter_in':'in'},price_basis='Group 3 listed price')
    add('fan-surplus','Alternative / PM268 / 12 V fan motor','cooling',source=GROUP3,location='Fan Motor, second option',price=12.95,
        model='PM268',link='https://surpluscenter.com/4550-rpm-12-vdc-fan-motor-pm268-12v-92/?sku=500287',
        specs={'listed_voltage_v':12,'listed_speed_rpm':4550,'listed_current_a':1.5,'listed_size_in':[7.5,6.5,4.875]},units={'listed_voltage_v':'V','listed_speed_rpm':'rpm','listed_current_a':'A','listed_size_in':'in'},
        notes='The supplied dimensions and current refer to this alternative only, not the selected eBay fan.',price_basis='Group 3 listed price')
    # Procurement quantities are packages, not installed vehicle quantities.
    rows=[
        ('esp32','ESP32 DevKitC WROOM-32 / two onboard, one spare','embedded_controllers',20,'https://www.amazon.com/s?k=ESP32+DevKitC+WROOM-32+3+pack',2,3,'on_vehicle','Original WROOM-32 specified; document excludes S3 for its PS4 Bluetooth Classic plan. Purchase one three-pack. Board power and installed two-board mass are unknown.'),
        ('camera','Wi-Fi camera / model TBD (ESP32-CAM fallback only)','vision',15,'https://www.amazon.com/s?k=ESP32-CAM+with+MB+programmer',1,1,'on_vehicle','Camera model remains TBD. Search link is a fallback, not a selected or ordered ESP32-CAM.'),
        ('dualshock','Sony DualShock 4 / operator controller','operator_controls',40,'https://www.amazon.com/s?k=Sony+DualShock+4+wireless+controller',0,1,'off_vehicle','Official used unit allowed; skip purchase if already available. Availability not established.'),
        ('microsd','32 GB microSD / computer OS storage','storage',10,'https://www.amazon.com/s?k=microSD+32GB+A1',None,1,'undecided','Purpose says Pi operating system, but no Raspberry Pi or other computer is selected in this list.'),
        ('router','GL.iNet travel router / Opal or Mango TBD','communications',30,'https://www.amazon.com/s?k=GL.iNet+travel+router+Opal',None,1,'undecided','Vehicle/lab network planned. Router model, location and power demand not finalized.'),
        ('level-shifter','Logic-level shifters / five-pack','signal_interface',6,'https://www.amazon.com/s?k=logic+level+converter+bi-directional+3.3V+5V+5+pack',None,5,'on_vehicle','Listed purpose: interface 5 V sensors with 3.3 V ESP32 pins. Number fitted and actual sensor interfaces are unknown.'),
        ('breadboard','Breadboard and jumper kit / prototype inventory','prototyping',12,'https://www.amazon.com/s?k=breadboard+jumper+wire+kit',0,1,'prototype','Prototyping stock; not counted as installed vehicle hardware.'),
        ('estop','Latching red E-stop button / ratings TBD','safety_controls',8,'https://www.amazon.com/s?k=emergency+stop+button+latching',1,1,'on_vehicle','Physical button is listed. Contact ratings, motor-power isolation path and stop-system behavior are not specified or validated.'),
    ]
    purchased=[]; installed=[]
    for row,(key,name,cat,price,link,count,pack,scope,note) in enumerate(rows,start=4):
        id=add(key,name,cat,source=GROUP4,location=f'Parts!B{row}:H{row}',price=price,link=link,notes=note,
            price_basis='Workbook estimated purchase line subtotal / USD',procurement_quantity=1,package_units=pack,installed_quantity=count,installation_scope=scope,
            purchase_status='Not ordered',part_status='planned; model TBD' if key in ['camera','router'] else 'planned')
        purchased.append(id)
        if scope=='on_vehicle': installed.append(id)
    missing=[]
    for key,cat,name in [
        ('battery','battery','Battery pack / specifications pending'),
        ('inverter','inverter','Traction motor controller / specifications pending'),
        ('chassis','chassis','Mechanical chassis and body / design pending'),
        ('tires','tires','Wheels and tires / design pending'),
        ('suspension','suspension','Suspension / design pending'),
        ('brakes','brakes','Braking system / design pending'),
        ('sensors','sensors','Sensor suite / specifications pending'),
        ('aux-supply','auxiliary','Auxiliary power supply / design pending'),
    ]:
        id=add(key,name,cat,source='User request and gaps in supplied documents',location='No specification supplied',
            notes='Placeholder only. No manufacturer, model, mass, cost or engineering ratings are assumed.',part_status='missing',placeholder=True)
        missing.append(id)
    common=[steering,fan,*installed,*missing]
    variants=[]
    for key,title,topology,material,selection in [
        ('belt','Single motor + rear belt drive','Proposed belt drive to rear wheels; no differential specified',20,motor),
        ('differential','Single motor + differential','Proposed single motor with fabricated differential',None,motor),
        ('dual-direct','Two motors / direct-drive concept','Proposed two-motor direct drive; geometry and control unresolved',None,None),
    ]:
        if key=='dual-direct':
            selection=add('motor-dual-assembly','Provisional pair / two eBay 256877952903 motors','motor',source=BUDGET,location='Two-motor direct-drive option',price=200,
                link='https://www.ebay.com/itm/256877952903',specs={'listed_voltage_v':48,'listed_power_per_motor_w':2000},units={'listed_voltage_v':'V','listed_power_per_motor_w':'W'},
                notes='Two candidate motors represented as one assembly. No aggregate continuous rating, mass, efficiency, controller count or torque sharing has been assumed.',installed_quantity=2,price_basis='Budget document: about $200 for two motors',part_status='alternative assembly')
        drivetrain=add('drive-'+key,topology,'drivetrain',source=BUDGET,location=f'{key} option',price=material,
            specs={'drive_type':'belt' if key=='belt' else 'unresolved','driven_wheels':'RWD'} if key=='belt' else {},units={'driven_wheels':'text'} if key=='belt' else {},
            notes='Concept only. Gear ratio, wheel diameter, efficiency, torque rating, axle geometry and handling are unknown.',part_status='proposed topology',
            price_basis='Derived allowance: $120 motor+belt minus ~$100 motor' if key=='belt' else 'No separate drive-material allowance listed' if key=='dual-direct' else 'Differential fabrication cost not supplied')
        purchase_ids=[selection,steering,fan,*purchased]+([drivetrain] if key!='dual-direct' else [])
        subtotal=sum(next(c['price'] or 0 for c in parts if c['id']==id) for id in purchase_ids)
        parameters={'document_project':'team-parts-2026-10-22','preferred_draft':key=='belt',
            'source_documents':[BUDGET,GROUP3,GROUP4],'procurement_component_ids':purchase_ids,
            'partial_budget_usd':subtotal,'budget_excludes':['Battery and BMS','Mechanical chassis, wheels, tires, brakes and suspension','Sensor suite','Traction controller unless separately confirmed included','Auxiliary supply, wiring, fuses and connectors','Unlisted compute hardware','Shipping and taxes','Unspecified fabrication/materials'],
            'budget_note':'Planning allowances only; not a complete vehicle cost. Group 4 includes spares and off-vehicle/prototype items. Camera budget remains although model is TBD.',
            'unresolved_systems':['Mechanical design and installed masses','Battery/BMS and power distribution','Sensors and feedback','Traction controller ratings and motor duty ratings','Auxiliary load and passenger/cargo payload'],
            'topology':topology,'vehicle_mode':'schematic draft; simulation blocked until required data supplied'}
        variants.append(Vehicle(id='team-ev-'+key,name='TEAM / '+title+' / draft',component_ids=[selection,drivetrain,*common],payload_kg=None,auxiliary_w=None,
            notes='Provisional assembly from the three supplied documents. The belt variant follows the budget preference, not a finalized design decision. No purchase or hardware validation is implied.',custom_parameters=parameters).model_dump())
    return parts,variants


if __name__=='__main__':
    components,vehicles=build()
    (ROOT/'data/components/team-parts.json').write_text(json.dumps(components,indent=2,ensure_ascii=False),encoding='utf-8')
    (ROOT/'data/vehicles/team-drafts.json').write_text(json.dumps(vehicles,indent=2,ensure_ascii=False),encoding='utf-8')
    print(f'Wrote {len(components)} documented candidates/placeholders and {len(vehicles)} provisional designs.')
