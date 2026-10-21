from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

class GoogleCredential(BaseModel):
    credential: str = Field(min_length=20)

class UserOut(BaseModel):
    id: int
    email: str
    name: str
    picture: str | None = None
    role: str
    model_config = ConfigDict(from_attributes=True)

class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class DriveCreate(BaseModel):
    company: str = Field(min_length=1, max_length=160)
    job_title: str = Field(min_length=1, max_length=200)
    description: str = ""
    package_lpa: float | None = Field(default=None, ge=0)
    min_cgpa: float = Field(default=0, ge=0, le=10)
    eligible_departments: list[str] = Field(default_factory=list)
    deadline: str | None = None
    status: Literal["DRAFT", "OPEN", "FROZEN", "CLOSED"] = "DRAFT"

class DriveOut(BaseModel):
    id: int
    company: str
    job_title: str
    description: str
    package_lpa: float | None
    min_cgpa: float
    eligible_departments: list[str]
    deadline: str | None
    status: str
    created_by_id: int

class ApplicationOut(BaseModel):
    id: int
    student_id: int
    drive_id: int
    status: str
    applied_at: str
    company: str
    job_title: str
