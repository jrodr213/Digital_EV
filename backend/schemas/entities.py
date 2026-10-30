from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator
import math


class Record(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Component(Record):
    id: str | None = None
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=80)
    manufacturer: str = ''
    model: str = ''
    mass_kg: float | None = Field(None, ge=0)
    price: float | None = Field(None, ge=0)
    notes: str = ''
    datasheet: str = ''
    hypothetical: bool = False
    specs: dict[str, Any] = Field(default_factory=dict)
    units: dict[str, str] = Field(default_factory=dict)
    custom_parameters: dict[str, Any] = Field(default_factory=dict)


class Vehicle(Record):
    id: str | None = None
    name: str = Field(min_length=1, max_length=160)
    component_ids: list[str]
    payload_kg: float | None = Field(None, ge=0)
    auxiliary_w: float | None = Field(None, ge=0)
    notes: str = ''
    custom_parameters: dict[str, Any] = Field(default_factory=dict)


class DriveCycle(Record):
    id: str | None = None
    name: str = Field(min_length=1)
    time_s: list[float] = Field(min_length=2, max_length=10000)
    speed_mps: list[float]
    grade: list[float]

    @model_validator(mode='after')
    def valid_trace(self):
        n = len(self.time_s)
        if len(self.speed_mps) != n or len(self.grade) != n:
            raise ValueError('Time, speed and grade arrays must have equal lengths.')
        if self.time_s[0] != 0 or any(b <= a for a, b in zip(self.time_s, self.time_s[1:])):
            raise ValueError('Time must start at zero and increase strictly.')
        if self.time_s[-1] > 14400 or any(v < 0 or v > 150 for v in self.speed_mps):
            raise ValueError('Cycle limit: 4 hours; speed must be between 0 and 150 m/s.')
        if any(abs(g) > .5 for g in self.grade):
            raise ValueError('Grade must be a fraction between -0.5 and 0.5.')
        return self


class RunRequest(Record):
    vehicle_id: str
    demo_mode: bool = False
    cycle: str = 'udds'
    test: Literal['cycle', 'acceleration', 'hill', 'load'] = 'cycle'
    extra_payload_kg: float = Field(0, ge=0, le=5000)
    grade: float = Field(0, ge=-.5, le=.5)
    target_mph: float = Field(30, gt=0, le=150)
    duration_s: int = Field(120, ge=10, le=3600)

    @model_validator(mode='after')
    def demo_cycle_default(self):
        if self.demo_mode and 'cycle' not in self.model_fields_set:
            self.cycle = 'demo-cart'
        return self


class SweepRequest(Record):
    vehicle_ids: list[str] = Field(min_length=1, max_length=12)
    cycle: str = 'udds'
    parameter: Literal['none', 'payload_kg', 'gear_ratio', 'wheel_diameter_m', 'capacity_ah', 'peak_power_kw'] = 'none'
    values: list[float] = Field(default_factory=list, max_length=12)
    metric: Literal['wh_per_mile', 'range_miles', 'top_speed_mph', 'zero_60_s'] = 'wh_per_mile'
