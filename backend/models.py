from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from config import DATABASE_PATH

DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class ContentItem(Base):
    __tablename__ = "content_items"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    description = Column(Text)
    media_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_path = Column(String(500), nullable=False)
    uploaded_by = Column(String(255))
    uploaded_at = Column(DateTime)
    expires_at = Column(DateTime)
    status = Column(String(50), default="uploaded")


class DisplaySession(Base):
    __tablename__ = "display_sessions"

    id = Column(Integer, primary_key=True)
    session_type = Column(String(50), nullable=False)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    device_type = Column(String(50))
    status = Column(String(50), default="active")
    uploaded_file_id = Column(Integer, ForeignKey("uploaded_files.id"))
    notes = Column(Text)

    uploaded_file = relationship("UploadedFile")


class ScreenState(Base):
    __tablename__ = "screen_state"

    id = Column(Integer, primary_key=True)
    mode = Column(String(50), nullable=False)
    current_content_id = Column(Integer, ForeignKey("content_items.id"))
    current_session_id = Column(Integer, ForeignKey("display_sessions.id"))
    last_changed_at = Column(DateTime)

    current_content = relationship("ContentItem")
    current_session = relationship("DisplaySession")


class BookingEvent(Base):
    __tablename__ = "booking_events"

    id = Column(Integer, primary_key=True)
    external_event_id = Column(String(255))
    title = Column(String(255), nullable=False)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    organiser = Column(String(255))
    location = Column(String(255))
    source = Column(String(100))
    synced_at = Column(DateTime)