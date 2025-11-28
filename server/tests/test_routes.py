from datetime import datetime, timedelta

from server.app import create_app
from server.database import db
from server.models import AccountGroup, Assignment, Kid, Shift, StaffMember


def test_root_endpoint(tmp_path, monkeypatch):
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + str(tmp_path / 'test.db')
    with app.app_context():
        db.drop_all()
        db.create_all()
        client = app.test_client()
        response = client.get('/')
        assert response.status_code == 200
        payload = response.get_json()
        assert payload['status'] == 'staffmonitr API'

def test_docs_endpoint(tmp_path):
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        response = client.get('/api/docs')
        assert response.status_code in (200, 404)


def test_shifts_return_nested_assignments(tmp_path):
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + str(tmp_path / 'test.db')
    with app.app_context():
        db.create_all()
        account = AccountGroup(name='Test Group', timezone='UTC')
        db.session.add(account)
        staff = StaffMember(full_name='Test Admin', email='invite@test.local', role='Admin')
        account.staff.append(staff)
        db.session.flush()
        shift = Shift(
            account_group_id=account.id,
            site='Main Hall',
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=4),
            ratio_min=2,
            leads_required=1,
        )
        db.session.add(shift)
        assignment = Assignment(shift=shift, staff=staff, title='Ratio Lead', difficulty_rating=3)
        db.session.add(assignment)
        kid = Kid(
            full_name='Kiddo',
            ratio='1:2',
            account_group_id=account.id,
            shift=shift,
            assignment=assignment,
        )
        db.session.add(kid)
        db.session.commit()
        client = app.test_client()
        response = client.get(f'/api/shifts?account_id={account.id}')
        assert response.status_code == 200
        payload = response.get_json()
        assert payload and payload[0]['assignments']
        assert payload[0]['assignments'][0]['kids']
        assert payload[0]['kids']


def test_auth_signup_login_and_me(tmp_path):
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + str(tmp_path / 'auth.db')

    payload = {
        'full_name': 'Owner Admin',
        'email': 'owner@example.com',
        'password': 'securePass123',
        'company': 'Portal HQ',
        'geofence': {'lat': 34.0, 'lon': -118.0, 'radiusMeters': 600},
    }

    with app.app_context():
        db.drop_all()
        db.create_all()
        client = app.test_client()

        signup_resp = client.post('/api/auth/signup', json=payload)
        assert signup_resp.status_code == 201
        signup_data = signup_resp.get_json()
        assert signup_data['staff']['email'] == payload['email']
        assert signup_data['accounts']

        me_resp = client.get('/api/auth/me')
        assert me_resp.status_code == 200
        me_data = me_resp.get_json()
        assert me_data['staff']['email'] == payload['email']

        login_resp = client.post('/api/auth/login', json={'email': payload['email'], 'password': payload['password']})
        assert login_resp.status_code == 200
        login_data = login_resp.get_json()
        assert login_data['staff']['email'] == payload['email']

        me_after_login = client.get('/api/auth/me')
        assert me_after_login.status_code == 200
        assert me_after_login.get_json()['staff']['email'] == payload['email']


def test_owner_admin_can_create_team_member(tmp_path):
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + str(tmp_path / 'team.db')

    payload = {
        'full_name': 'Owner Admin',
        'email': 'owner-team@example.com',
        'password': 'teamPass123',
        'company': 'Regulated Site',
    }

    with app.app_context():
        db.drop_all()
        db.create_all()
        client = app.test_client()

        signup_resp = client.post('/api/auth/signup', json=payload)
        assert signup_resp.status_code == 201
        signup_data = signup_resp.get_json()
        account = signup_data['accounts'][0]

        new_staff = {
            'full_name': 'Backfill Staff',
            'email': 'backfill@example.com',
            'password': 'strongPass123',
            'role': 'Staff',
        }

        create_resp = client.post(f"/api/accounts/{account['id']}/staff", json=new_staff)
        assert create_resp.status_code == 201
        created = create_resp.get_json()
        assert created['email'] == new_staff['email']
        assert account['id'] in created['assigned_account_ids']


def test_notifications_endpoints(tmp_path):
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + str(tmp_path / 'notify.db')
    with app.app_context():
        db.create_all()
        account = AccountGroup(name='Alerts', timezone='UTC')
        staff = StaffMember(full_name='Notifier', email='notify@example.com', role='Admin')
        account.staff.append(staff)
        db.session.add(account)
        db.session.add(staff)
        shift = Shift(
            account_group=account,
            site='Alert Site',
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=4),
            ratio_min=1,
        )
        db.session.add(shift)
        assignment = Assignment(shift=shift, staff=staff, title='Notify', difficulty_rating=2)
        db.session.add(assignment)
        db.session.commit()

        client = app.test_client()
        register_resp = client.post('/api/notifications/register', json={'staff_id': staff.id, 'token': 'token'})
        assert register_resp.status_code == 201

        notify_resp = client.post(f'/api/notifications/assignment/{assignment.id}')
        assert notify_resp.status_code == 200
