import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    from faker import Faker
except ModuleNotFoundError:  # fallback for environments that don’t have Faker installed
    class _FallbackFaker:
        FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Jamie']
        LAST_NAMES = ['Reed', 'Parker', 'Morgan', 'Quinn', 'Hayes', 'Rivera', 'Cole']
        JOBS = ['Program Coordinator', 'Support Coach', 'Team Lead', 'Driver', 'Support Specialist']
        CITIES = ['Portland', 'Austin', 'Seattle', 'Denver', 'Raleigh', 'Atlanta', 'Phoenix']
        COMPANIES = ['Pioneer', 'Summit', 'Northside', 'Harbor', 'Atlas', 'Riverbend']
        COLORS = ['#0ea5e9', '#f97316', '#22c55e', '#facc15', '#e11d48', '#6366f1']
        WORDS = ['care', 'support', 'shift', 'family', 'team', 'safety', 'growth', 'plan', 'kids', 'circle']

        def __init__(self):
            self._rng = random.Random()
            self.unique = self._UniqueEmail(self)

        def seed_instance(self, seed):
            self._rng.seed(seed)
            self.unique._seen.clear()

        class _UniqueEmail:
            def __init__(self, parent):
                self.parent = parent
                self._seen = set()

            def email(self):
                candidate = self.parent.email()
                while candidate in self._seen:
                    candidate = self.parent.email()
                self._seen.add(candidate)
                return candidate

        def _pick(self, values):
            return self._rng.choice(values)

        def company(self):
            return f"{self._pick(self.COMPANIES)} {self._pick(['Campus', 'Collective', 'Group', 'Center'])}"

        def name(self):
            return f"{self._pick(self.FIRST_NAMES)} {self._pick(self.LAST_NAMES)}"

        def city(self):
            return self._pick(self.CITIES)

        def job(self):
            return self._pick(self.JOBS)

        def color(self):
            return self._pick(self.COLORS)

        def latitude(self):
            return f"{self._rng.uniform(-90, 90):.6f}"

        def longitude(self):
            return f"{self._rng.uniform(-180, 180):.6f}"

        def email(self):
            name = self.name().lower().replace(' ', '.')
            domain = self._pick(['example.com', 'demo.staffmonitr.dev'])
            return f"{name}{self._rng.randint(1, 999)}@{domain}"

        def paragraph(self, nb_sentences=2):
            sentences = [self.sentence(nb_words=10) for _ in range(nb_sentences)]
            return ' '.join(sentences)

        def sentence(self, nb_words=8):
            words = [self._pick(self.WORDS) for _ in range(nb_words)]
            sentence = ' '.join(words)
            return sentence.capitalize() + '.'

    Faker = _FallbackFaker

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from server.app import create_app
from server.database import db
from server.models import AccountGroup, Assignment, Kid, Shift, StaffMember
from server.services.auth import hash_password

faker = Faker()
faker.seed_instance(23)
random.seed(42)

TIMEZONES = ['America/Los_Angeles', 'America/New_York', 'America/Chicago', 'UTC']
ROLES = ['Admin', 'Lead', 'Coach', 'Driver', 'Support']
RATIOS = ['1:1', '1:2', '1:3', '1:4']
DIFFICULTIES = ['standard', 'challenging', 'special']

DEMO_CREDENTIALS = [
    {
        'full_name': 'Javier Admin',
        'email': 'demo-admin@staffmonitr.dev',
        'password': 'AdminSafe123!',
        'role': 'Owner_admin',
    },
    {
        'full_name': 'Javier Lead',
        'email': 'demo-lead@staffmonitr.dev',
        'password': 'LeadSafe123!',
        'role': 'Lead',
    },
    {
        'full_name': 'Javier Staff',
        'email': 'demo-staff@staffmonitr.dev',
        'password': 'StaffSafe123!',
        'role': 'Staff',
    },
]


def create_account_group():
    group = AccountGroup(
        name=f"{faker.company()} Campus",
        timezone=random.choice(TIMEZONES),
        geofence_lat=float(faker.latitude()),
        geofence_lon=float(faker.longitude()),
        geofence_radius=random.randint(500, 1500),
        brand_primary=faker.color(),
    )
    db.session.add(group)
    return group


def create_demo_account_group():
    group = AccountGroup(
        name='StaffMonitr Demo Campus',
        timezone='America/Los_Angeles',
        geofence_lat=34.052235,
        geofence_lon=-118.243683,
        geofence_radius=1600,
        brand_primary='#0ea5e9',
    )
    db.session.add(group)
    return group


def create_test_accounts(group):
    for creds in DEMO_CREDENTIALS:
        staff = StaffMember(
            full_name=creds['full_name'],
            email=creds['email'],
            role=creds['role'],
            status='active',
            invited_at=datetime.utcnow(),
            invite_expires_at=datetime.utcnow() + timedelta(days=30),
            password_hash=hash_password(creds['password']),
        )
        group.staff.append(staff)
        db.session.add(staff)


def create_staff_pool(group, count=6):
    staff_members = []
    for _ in range(count):
        member = StaffMember(
            full_name=faker.name(),
            email=faker.unique.email(),
            role=random.choice(ROLES),
            status=random.choice(['active', 'pending']),
            invited_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            invite_expires_at=datetime.utcnow() + timedelta(days=random.randint(1, 14)),
        )
        group.staff.append(member)
        db.session.add(member)
        staff_members.append(member)
    return staff_members


def create_shift(group):
    start = datetime.utcnow() + timedelta(days=random.randint(0, 7), hours=random.randint(6, 16))
    duration = random.choice([6, 7, 8, 9])
    shift = Shift(
        account_group=group,
        site=f"{faker.city()} Rec Center",
        start_time=start,
        end_time=start + timedelta(hours=duration),
        ratio_min=random.randint(1, 4),
        leads_required=random.randint(1, 3),
        difficulty=random.choice(DIFFICULTIES),
        is_special=random.choice([False, False, True]),
        open_shift=random.choice([False, True]),
    )
    db.session.add(shift)
    return shift


def create_assignment(shift, staff_members):
    staff = random.choice(staff_members)
    assignment = Assignment(
        shift=shift,
        staff=staff,
        title=faker.job(),
        difficulty_rating=random.randint(1, 5),
        instructions=faker.paragraph(nb_sentences=2),
        requires_one_on_one=random.choice([False, True, False]),
    )
    db.session.add(assignment)
    return assignment


def create_kids(group, shift, assignment, count=3):
    staff_emails = [s.email for s in group.staff]
    for _ in range(count):
        ratio = random.choice(RATIOS)
        kid = Kid(
            full_name=faker.name(),
            ratio=ratio,
            special_instructions=faker.sentence(nb_words=12),
            banned_staff=random.sample(staff_emails, k=min(len(staff_emails), random.randint(0, 2))),
            requires_personal_trainer=random.choice([False, True, False]),
            account_group=group,
            shift=shift,
            assignment=assignment,
        )
        db.session.add(kid)


def seed():
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        demo_group = create_demo_account_group()
        create_test_accounts(demo_group)
        groups = [create_account_group() for _ in range(3)] + [demo_group]
        for group in groups:
            staff_members = create_staff_pool(group, count=random.randint(5, 8))
            for _ in range(random.randint(2, 4)):
                shift = create_shift(group)
                assignment = create_assignment(shift, staff_members)
                create_kids(group, shift, assignment, count=random.randint(2, 5))

        db.session.commit()


if __name__ == '__main__':
    seed()
