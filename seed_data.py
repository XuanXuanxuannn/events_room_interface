from datetime import datetime, timedelta
from models import SessionLocal, ContentItem, ScreenState, BookingEvent

db = SessionLocal()

# ----------------------------
# 1. 插入多条 billboard 内容
# ----------------------------
contents = [
    ContentItem(
        title="Welcome to CBRIN",
        type="announcement",
        description="Welcome message for visitors",
        media_url="/static/uploads/welcome.png",
        is_active=True,
        display_order=1,
        created_at=datetime.now(),
        updated_at=datetime.now()
    ),
    ContentItem(
        title="AI Workshop Today",
        type="event",
        description="Join us at 2 PM in Room 101",
        media_url="/static/uploads/workshop.png",
        is_active=True,
        display_order=2,
        created_at=datetime.now(),
        updated_at=datetime.now()
    ),
    ContentItem(
        title="Partner: NVIDIA",
        type="sponsor",
        description="Sponsored by NVIDIA",
        media_url="/static/uploads/nvidia.png",
        is_active=True,
        display_order=3,
        created_at=datetime.now(),
        updated_at=datetime.now()
    ),
    ContentItem(
        title="Community Meetup",
        type="event",
        description="Networking event this Friday",
        media_url="/static/uploads/meetup.png",
        is_active=True,
        display_order=4,
        created_at=datetime.now(),
        updated_at=datetime.now()
    ),
]

db.add_all(contents)
db.commit()

# ----------------------------
# 2. 设置 screen_state
# ----------------------------
state = ScreenState(
    mode="billboard",
    current_content_id=contents[0].id,
    current_session_id=None,
    last_changed_at=datetime.now()
)

db.add(state)
db.commit()

# ----------------------------
# 3. 插入 booking_events
# ----------------------------
now = datetime.now()

bookings = [
    BookingEvent(
        external_event_id="evt_001",
        title="Machine Learning Lecture",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
        organiser="Dr. Smith",
        location="Room 101",
        source="Google Calendar",
        synced_at=now
    ),
    BookingEvent(
        external_event_id="evt_002",
        title="AI Ethics Panel",
        start_time=now + timedelta(hours=2),
        end_time=now + timedelta(hours=4),
        organiser="CBRIN Team",
        location="Room 101",
        source="Google Calendar",
        synced_at=now
    ),
]

db.add_all(bookings)
db.commit()

db.close()

print("Seed data inserted successfully.")