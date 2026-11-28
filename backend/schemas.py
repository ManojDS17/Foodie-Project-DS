from typing import Optional, List
from datetime import datetime
import re
import uuid
from pydantic import BaseModel, Field, field_validator, model_validator

EMAIL_REGEX = r'^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}$'
SITE_CODE_REGEX = r'^[A-Za-z0-9-_]{2,20}$'
PHONE_REGEX = r'^\+?[0-9\s]{7,15}$'
VALID_ROLES = ['OEM_MANAGER', 'SITE_ADMIN', 'OPERATOR']

def validate_iso_date_string(v: Optional[str], field_name: str = "Date") -> Optional[str]:
    if not v or not str(v).strip():
        return None
    clean = str(v).strip()
    try:
        parsed = datetime.strptime(clean, "%Y-%m-%d").date()
        return parsed.strftime("%Y-%m-%d")
    except ValueError as exc:
        raise ValueError(f"{field_name} must be a valid YYYY-MM-DD date.") from exc

def validate_uuid_string(v: Optional[str], field_name: str = "ID") -> Optional[str]:
    if not v or not str(v).strip():
        return None
    clean = str(v).strip()
    try:
        return str(uuid.UUID(clean))
    except ValueError as exc:
        raise ValueError(f"Invalid {field_name} format. Expected a valid UUID.") from exc

def validate_email_address(v: Optional[str]) -> Optional[str]:
    if not v or not v.strip():
        return None
    clean = v.strip().lower()
    if clean.startswith('.') or clean.endswith('.') or '..' in clean or '.@' in clean or '@.' in clean or not re.match(EMAIL_REGEX, clean):
        raise ValueError('Please enter a valid business email address (e.g. name@company.com or name@company.com.au).')
    return clean

def validate_phone_number(v: Optional[str]) -> Optional[str]:
    if not v or not v.strip():
        return None
    clean = v.strip()
    if re.search(r'[^0-9+\s]', clean):
        raise ValueError('Phone number can only contain numbers, spaces, and an optional leading plus (+). Symbols like -, (, ) are not allowed.')
    if '+' in clean and (not clean.startswith('+') or clean.count('+') > 1):
        raise ValueError('The plus sign (+) is only permitted at the beginning of the phone number.')
    if len(clean) > 15:
        raise ValueError('Phone number cannot exceed 15 characters.')
    digits = re.sub(r'\D', '', clean)
    if len(digits) < 7:
        raise ValueError('Phone number must contain at least 7 digits.')
    if len(digits) > 15:
        raise ValueError('Phone number cannot exceed 15 digits.')
    return clean

def validate_password_complexity(v: Optional[str], field_name: str = "Password") -> Optional[str]:
    if not v or not v.strip():
        return None
    clean = v.strip()
    if len(clean) < 12:
        raise ValueError(f'{field_name} must be at least 12 characters long.')
    if len(clean) > 50:
        raise ValueError(f'{field_name} cannot exceed 50 characters.')
    if not re.search(r'[0-9]', clean):
        raise ValueError(f'{field_name} must contain at least one number (0-9).')
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', clean):
        raise ValueError(f'{field_name} must contain at least one special character / symbol.')
    return clean

def validate_max_words(v: Optional[str], field_name: str = "Full name", max_words: int = 20) -> Optional[str]:
    if not v or not v.strip():
        return v
    clean = v.strip()
    words = clean.split()
    if len(words) > max_words:
        raise ValueError(f'{field_name} cannot exceed {max_words} words.')
    return clean

def validate_abn(v: Optional[str]) -> Optional[str]:
    if not v or not v.strip():
        return None
    clean = re.sub(r'\D', '', v.strip())
    if len(clean) != 11:
        raise ValueError('Tax ID (ABN) must be exactly 11 digits (e.g. 51 824 753 556)')
    weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
    total = (int(clean[0]) - 1) * weights[0] + sum(int(clean[i]) * weights[i] for i in range(1, 11))
    if total % 89 != 0:
        raise ValueError('Invalid Australian Business Number (ABN). The number does not pass the official ABR Modulus 89 checksum.')
    return f"{clean[:2]} {clean[2:5]} {clean[5:8]} {clean[8:]}"

def validate_location_string(v: Optional[str]) -> Optional[str]:
    if not v or not v.strip():
        return None
    clean = v.strip()
    if len(clean) < 3:
        raise ValueError('Location must be at least 3 characters long.')
    if len(clean) > 100:
        raise ValueError('Location cannot exceed 100 characters.')
    if re.search(r'[;<>{}]|--|/\*', clean) or not re.match(r"^[A-Za-z0-9\s,.\-#/()'&]+$", clean):
        raise ValueError('Location can only contain letters, numbers, spaces, and standard address punctuation (e.g. commas, hyphens, periods, #). Special characters and code symbols are not permitted.')
    return clean

def validate_description_string(v: Optional[str]) -> Optional[str]:
    if not v or not v.strip():
        return None
    clean = v.strip()
    if len(clean) > 300:
        raise ValueError('Location description cannot exceed 300 characters.')
    if re.search(r'[<>{}]|--|/\*|;', clean):
        raise ValueError('Location description contains invalid characters or code tags.')
    return clean

# --------------------------------------------------------------------------
# Authentication Schemas
# --------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = True

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean.startswith('.') or clean.endswith('.') or '..' in clean or '.@' in clean or '@.' in clean or not re.match(EMAIL_REGEX, clean):
            raise ValueError('Please enter a valid email address.')
        return clean

class UserResponse(BaseModel):
    id: str
    organization_id: Optional[str] = None
    email: str
    first_name: str
    last_name: str
    role: str
    phone_number: Optional[str] = None
    is_active: bool
    status: Optional[str] = None
    company_name: Optional[str] = None
    client_code: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    deleted_by: Optional[str] = None
    created_by_name: Optional[str] = None

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean.startswith('.') or clean.endswith('.') or '..' in clean or '.@' in clean or '@.' in clean or not re.match(EMAIL_REGEX, clean):
            raise ValueError('Please enter a valid email address.')
        return clean

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        clean = validate_password_complexity(v, "Password")
        if not clean:
            raise ValueError('Password must be at least 12 characters long.')
        return clean


# --------------------------------------------------------------------------
# User Management Schemas
# --------------------------------------------------------------------------
class UserCreate(BaseModel):
    organization_id: Optional[str] = None
    email: str
    password: Optional[str] = None
    first_name: str
    last_name: Optional[str] = ""
    role: str
    phone_number: Optional[str] = None

    @field_validator('organization_id')
    @classmethod
    def check_org_id(cls, v: Optional[str]) -> Optional[str]:
        return validate_uuid_string(v, "organization ID")

    @field_validator('email')
    @classmethod
    def check_email(cls, v: str) -> str:
        clean = validate_email_address(v)
        if not clean:
            raise ValueError('Please enter a valid business email address.')
        return clean

    @field_validator('role')
    @classmethod
    def check_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
        return v

    @field_validator('password')
    @classmethod
    def check_password(cls, v: Optional[str]) -> Optional[str]:
        return validate_password_complexity(v, "Password")

    @field_validator('first_name')
    @classmethod
    def check_first_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError('First name is required.')
        return validate_max_words(clean, "First name", 20) or clean

    @field_validator('last_name')
    @classmethod
    def check_last_name(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return ""
        return validate_max_words(v.strip(), "Last name", 20) or v.strip()

    @field_validator('phone_number')
    @classmethod
    def check_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_number(v)

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('email')
    @classmethod
    def check_email_update(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_email_address(v)
        return v

    @field_validator('first_name', 'last_name')
    @classmethod
    def check_names_update(cls, v: Optional[str]) -> Optional[str]:
        return validate_max_words(v, "Name", 20)

    @field_validator('phone_number')
    @classmethod
    def check_phone_update(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_number(v)

    @field_validator('role')
    @classmethod
    def check_role(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
        return v

# --------------------------------------------------------------------------
# Organization & Global Search Schemas
# --------------------------------------------------------------------------
class MachineAssignmentItem(BaseModel):
    machine_id: str
    location: Optional[str] = None
    lease_start_date: Optional[str] = None
    lease_end_date: Optional[str] = None

    @field_validator('lease_start_date')
    @classmethod
    def check_lease_start_date(cls, v: Optional[str]) -> Optional[str]:
        return validate_iso_date_string(v, "Lease start date")

    @field_validator('lease_end_date')
    @classmethod
    def check_lease_end_date(cls, v: Optional[str]) -> Optional[str]:
        return validate_iso_date_string(v, "Lease end date")

    @model_validator(mode='after')
    def check_date_order(self) -> 'MachineAssignmentItem':
        if self.lease_start_date and self.lease_end_date and self.lease_end_date < self.lease_start_date:
            raise ValueError(f"Lease end date ({self.lease_end_date}) cannot be earlier than lease start date ({self.lease_start_date}).")
        return self

class OrganizationCreate(BaseModel):
    client_code: str
    company_name: str
    onboarding_date: Optional[str] = None
    business_type: Optional[str] = 'Corporate'
    status: Optional[str] = 'Active'
    tax_id: Optional[str] = None
    contact_poc: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    phone_number: Optional[str] = None
    website: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    payment_terms: Optional[str] = '30 days'
    comms_preference: Optional[str] = 'Email'
    assigned_machines: Optional[List[MachineAssignmentItem]] = None
    is_active: Optional[bool] = True

    @field_validator('company_name')
    @classmethod
    def check_company_name(cls, v: str) -> str:
        return validate_max_words(v, "Company name", 20) or v

    @field_validator('contact_poc')
    @classmethod
    def check_contact_poc(cls, v: Optional[str]) -> str:
        if not v or not v.strip():
            raise ValueError('Point of contact name is required.')
        clean = v.strip()
        if len(clean) > 50:
            raise ValueError('Point of contact name cannot exceed 50 characters.')
        return clean

    @field_validator('email')
    @classmethod
    def check_email_org(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            raise ValueError('Primary contact email address is required.')
        return validate_email_address(v)

    @field_validator('phone_number')
    @classmethod
    def check_phone_org(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_number(v)

    @field_validator('password')
    @classmethod
    def check_password_org(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            raise ValueError('Account password is required.')
        return validate_password_complexity(v, "Password")

    @field_validator('onboarding_date')
    @classmethod
    def check_onboarding_date(cls, v: Optional[str]) -> Optional[str]:
        return validate_iso_date_string(v, "Onboarding date")

    @field_validator('payment_terms')
    @classmethod
    def check_payment_terms(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return '30 days'
        clean = v.strip()
        if clean not in VALID_PAYMENT_TERMS:
            return '30 days'
        return clean

    @field_validator('comms_preference')
    @classmethod
    def check_comms_pref(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return 'Email'
        clean = v.strip()
        if clean not in VALID_COMMS_PREFERENCES:
            return 'Email'
        return clean

    @field_validator('tax_id')
    @classmethod
    def check_tax_id(cls, v: Optional[str]) -> Optional[str]:
        return validate_abn(v)

class OrganizationUpdate(BaseModel):
    company_name: Optional[str] = None
    onboarding_date: Optional[str] = None
    business_type: Optional[str] = None
    status: Optional[str] = None
    tax_id: Optional[str] = None
    contact_poc: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    website: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    payment_terms: Optional[str] = None
    comms_preference: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('company_name')
    @classmethod
    def check_company_name(cls, v: str) -> str:
        return validate_max_words(v, "Company name", 20) or v

    @field_validator('contact_poc')
    @classmethod
    def check_contact_poc(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        clean = v.strip()
        if len(clean) > 50:
            raise ValueError('Point of contact name cannot exceed 50 characters.')
        return clean

    @field_validator('phone_number')
    @classmethod
    def check_phone_org(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_number(v)

    @field_validator('onboarding_date')
    @classmethod
    def check_onboarding_date_update(cls, v: Optional[str]) -> Optional[str]:
        return validate_iso_date_string(v, "Onboarding date")

    @field_validator('tax_id')
    @classmethod
    def check_tax_id_update(cls, v: Optional[str]) -> Optional[str]:
        return validate_abn(v)

class OrganizationResponse(BaseModel):
    id: str
    client_code: str
    company_name: str
    onboarding_date: Optional[str] = None
    business_type: Optional[str] = 'Corporate'
    status: Optional[str] = 'Active'
    tax_id: Optional[str] = None
    contact_poc: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    website: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    payment_terms: Optional[str] = None
    comms_preference: Optional[str] = 'Email'
    is_active: bool
    is_deleted: Optional[bool] = False
    deleted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    deleted_by: Optional[str] = None
    created_by_name: Optional[str] = None
    total_machines: Optional[int] = 0

class BulkDeleteRequest(BaseModel):
    ids: List[str]

    @field_validator('ids')
    @classmethod
    def check_ids(cls, v: List[str]) -> List[str]:
        cleaned: List[str] = []
        for item in v:
            parsed = validate_uuid_string(item, "client ID")
            if not parsed:
                raise ValueError("Client IDs cannot be empty.")
            cleaned.append(parsed)
        return cleaned

class SearchResultItemClient(BaseModel):
    id: str
    client_code: str
    company_name: str
    contact_poc: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[str] = 'Active'

class SearchResultItemUser(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    role: str
    phone_number: Optional[str] = None

class SearchResultItemMachine(BaseModel):
    id: str
    machine_code: str
    serial_number: str
    model: str
    location: Optional[str] = ''
    company_name: Optional[str] = 'Unassigned'
    status: str
    connectivity_status: Optional[str] = 'Offline'
    temp: Optional[str] = None

class SearchResponse(BaseModel):
    clients: List[SearchResultItemClient] = []
    machines: List[SearchResultItemMachine] = []
    sites: List[dict] = []
    users: List[SearchResultItemUser] = []

# --------------------------------------------------------------------------
# Machine Management & Commissioning Schemas
# --------------------------------------------------------------------------
MACHINE_CODE_REGEX = r'^[A-Za-z0-9-_]{2,20}$'
VALID_CONNECTIVITY = ['Online', 'Offline']
VALID_PAYMENT_TERMS = ['15 days', '30 days', '60 days']
VALID_COMMS_PREFERENCES = ['Email', 'Phone']

class MachineModelResponse(BaseModel):
    id: str
    model_code: str
    display_name: str
    capacity: str
    is_active: bool

class TerminateLeaseRequest(BaseModel):
    termination_remark: Optional[str] = None

class OperatorMachineAssignmentCreate(BaseModel):
    operator_id: str
    machine_id: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None

    @field_validator('operator_id')
    @classmethod
    def check_operator_id(cls, v: str) -> str:
        parsed = validate_uuid_string(v, "operator ID")
        if not parsed:
            raise ValueError("Operator ID is required.")
        return parsed

    @field_validator('machine_id')
    @classmethod
    def check_machine_id(cls, v: str) -> str:
        parsed = validate_uuid_string(v, "machine ID")
        if not parsed:
            raise ValueError("Machine ID is required.")
        return parsed

    @field_validator('start_date')
    @classmethod
    def check_start_date(cls, v: Optional[str]) -> Optional[str]:
        return validate_iso_date_string(v, "Start date")

    @field_validator('end_date')
    @classmethod
    def check_end_date(cls, v: Optional[str]) -> Optional[str]:
        return validate_iso_date_string(v, "End date")

    @model_validator(mode='after')
    def check_assignment_dates(self) -> 'OperatorMachineAssignmentCreate':
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError(f"End date ({self.end_date}) cannot be earlier than start date ({self.start_date}).")
        return self

class OperatorMachineAssignmentResponse(BaseModel):
    id: str
    organization_id: str
    operator_id: str
    operator_name: Optional[str] = None
    operator_email: Optional[str] = None
    machine_id: str
    machine_code: Optional[str] = None
    serial_number: Optional[str] = None
    model: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    created_by: Optional[str] = None
    assigned_by: Optional[str] = None
    assigned_at: Optional[datetime] = None
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    revoked_by: Optional[str] = None
    revoked_at: Optional[datetime] = None
    status: str
    created_at: Optional[datetime] = None

class MachineCreate(BaseModel):
    serial_number: Optional[str] = None
    machine_code: Optional[str] = None
    model: str
    model_id: Optional[str] = None
    capacity: Optional[str] = None
    hardware_version: Optional[str] = None
    organization_id: Optional[str] = None
    location_label: Optional[str] = None
    lease_location_label: Optional[str] = None
    location_description: Optional[str] = None
    plc_software_version: Optional[str] = None
    energy_meter_model: Optional[str] = None
    deodor_model: Optional[str] = None
    extractor_model: Optional[str] = None
    has_stairs: Optional[bool] = False
    notes: Optional[str] = None
    connectivity_status: Optional[str] = 'Offline'
    operational_status: Optional[str] = 'Idle'

    @field_validator('machine_code')
    @classmethod
    def check_machine_code(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        clean = v.strip().upper()
        if not re.match(MACHINE_CODE_REGEX, clean):
            raise ValueError('Machine Code must be 2-20 alphanumeric characters (e.g. C001, C137).')
        return clean

    @field_validator('serial_number')
    @classmethod
    def check_serial(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        clean = v.strip().upper()
        if len(clean) < 2:
            raise ValueError('Serial number must be at least 2 characters.')
        return clean

    @field_validator('model')
    @classmethod
    def check_model(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError('Model is required.')
        return clean

    @field_validator('location_label', 'lease_location_label')
    @classmethod
    def check_location_label(cls, v: Optional[str]) -> Optional[str]:
        return validate_location_string(v)

    @field_validator('location_description')
    @classmethod
    def check_location_description(cls, v: Optional[str]) -> Optional[str]:
        return validate_description_string(v)

    @field_validator('connectivity_status')
    @classmethod
    def check_connectivity(cls, v: Optional[str]) -> str:
        if v and v not in VALID_CONNECTIVITY:
            raise ValueError(f"Connectivity status must be one of: {', '.join(VALID_CONNECTIVITY)}")
        return v or 'Offline'

    @field_validator('organization_id')
    @classmethod
    def check_organization_id(cls, v: Optional[str]) -> Optional[str]:
        return validate_uuid_string(v, "organization ID")

    @field_validator('model_id')
    @classmethod
    def check_model_id(cls, v: Optional[str]) -> Optional[str]:
        return validate_uuid_string(v, "model ID")

class MachineUpdate(BaseModel):
    serial_number: Optional[str] = None
    model: Optional[str] = None
    model_id: Optional[str] = None
    capacity: Optional[str] = None
    hardware_version: Optional[str] = None
    organization_id: Optional[str] = None
    location_label: Optional[str] = None
    lease_location_label: Optional[str] = None
    location_description: Optional[str] = None
    plc_software_version: Optional[str] = None
    energy_meter_model: Optional[str] = None
    deodor_model: Optional[str] = None
    extractor_model: Optional[str] = None
    has_stairs: Optional[bool] = None
    notes: Optional[str] = None
    connectivity_status: Optional[str] = None
    operational_status: Optional[str] = None
    is_active: Optional[bool] = None
    lease_start_date: Optional[str] = None
    lease_end_date: Optional[str] = None
    lease_status: Optional[str] = None

    @field_validator('location_label', 'lease_location_label')
    @classmethod
    def check_location_label(cls, v: Optional[str]) -> Optional[str]:
        return validate_location_string(v)

    @field_validator('location_description')
    @classmethod
    def check_location_description(cls, v: Optional[str]) -> Optional[str]:
        return validate_description_string(v)

    @field_validator('connectivity_status')
    @classmethod
    def check_connectivity(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in VALID_CONNECTIVITY:
            raise ValueError(f"Connectivity status must be one of: {', '.join(VALID_CONNECTIVITY)}")
        return v

    @field_validator('organization_id')
    @classmethod
    def check_organization_id(cls, v: Optional[str]) -> Optional[str]:
        return validate_uuid_string(v, "organization ID")

    @field_validator('model_id')
    @classmethod
    def check_model_id(cls, v: Optional[str]) -> Optional[str]:
        return validate_uuid_string(v, "model ID")

    @field_validator('lease_start_date')
    @classmethod
    def check_lease_start_date(cls, v: Optional[str]) -> Optional[str]:
        return validate_iso_date_string(v, "Lease start date")

    @field_validator('lease_end_date')
    @classmethod
    def check_lease_end_date(cls, v: Optional[str]) -> Optional[str]:
        return validate_iso_date_string(v, "Lease end date")

    @model_validator(mode='after')
    def check_lease_dates(self) -> 'MachineUpdate':
        if self.lease_start_date and self.lease_end_date and self.lease_end_date < self.lease_start_date:
            raise ValueError(f"Lease end date ({self.lease_end_date}) cannot be earlier than lease start date ({self.lease_start_date}).")
        return self

class MachineResponse(BaseModel):
    id: str
    machine_code: str
    serial_number: str
    model: str
    model_id: Optional[str] = None
    capacity: Optional[str] = None
    hardware_version: Optional[str] = None
    organization_id: Optional[str] = None
    client_code: Optional[str] = None
    company_name: Optional[str] = None
    location_label: Optional[str] = None
    lease_location_label: Optional[str] = None
    location_description: Optional[str] = None
    plc_software_version: Optional[str] = None
    energy_meter_model: Optional[str] = None
    deodor_model: Optional[str] = None
    extractor_model: Optional[str] = None
    has_stairs: Optional[bool] = False
    notes: Optional[str] = None
    lease_start_date: Optional[str] = None
    lease_end_date: Optional[str] = None
    lease_status: Optional[str] = 'Active'
    lease_reference: Optional[str] = None
    connectivity_status: Optional[str] = 'Offline'
    operational_status: Optional[str] = 'Idle'
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    deleted_by: Optional[str] = None
    created_by_name: Optional[str] = None
    total_machines: Optional[int] = 0
    telemetry: Optional[dict] = None

