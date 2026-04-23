from datetime import datetime
from typing import Optional, Tuple, List
from sqlalchemy import or_
from models import (
    SessionLocal,
    ContentItem,
    UploadedFile,
    DisplaySession,
    ScreenState,
    BookingEvent,
)


def get_active_content_items() -> List[ContentItem]:
    """
    获取当前所有“可展示”的 billboard 内容

    规则：
    - is_active = True
    - start_time <= 当前时间（或为空）
    - end_time >= 当前时间（或为空）
    - 按 display_order 排序

    用途：
    - billboard 页面展示轮播内容
    """
    db = SessionLocal()
    try:
        now = datetime.now()

        items = (
            db.query(ContentItem)
            .filter(ContentItem.is_active.is_(True))
            .filter(or_(ContentItem.start_time.is_(None), ContentItem.start_time <= now))
            .filter(or_(ContentItem.end_time.is_(None), ContentItem.end_time >= now))
            .order_by(ContentItem.display_order.asc(), ContentItem.id.asc())
            .all()
        )

        return items
    finally:
        db.close()


def get_current_screen_state() -> Optional[ScreenState]:
    """
    获取当前屏幕状态（presentation / billboard）

    返回：
    - 当前 screen_state 表中的第一条记录（MVP 假设只有一条）

    用途：
    - 前端判断当前显示模式
    - 后端控制页面切换
    """
    db = SessionLocal()
    try:
        state = db.query(ScreenState).first()
        return state
    finally:
        db.close()


def create_uploaded_file(
    filename: str,
    file_type: str,
    file_path: str,
    uploaded_by: Optional[str] = None,
    expires_at: Optional[datetime] = None,
    status: str = "uploaded",
) -> UploadedFile:
    """
    创建一条“上传文件记录”

    参数：
    - filename：文件名
    - file_type：文件类型（pdf / ppt / video）
    - file_path：文件存储路径
    - uploaded_by：上传者（可选）
    - expires_at：过期时间（用于临时文件）
    - status：状态（默认 uploaded）

    返回：
    - 创建后的 UploadedFile 对象

    用途：
    - 记录用户上传的文件（用于展示）
    """
    db = SessionLocal()
    try:
        new_file = UploadedFile(
            filename=filename,
            file_type=file_type,
            file_path=file_path,
            uploaded_by=uploaded_by,
            uploaded_at=datetime.now(),
            expires_at=expires_at,
            status=status,
        )

        db.add(new_file)
        db.commit()
        db.refresh(new_file)

        return new_file
    finally:
        db.close()


def create_display_session(
    session_type: str,
    device_type: Optional[str] = None,
    uploaded_file_id: Optional[int] = None,
    notes: Optional[str] = None,
    status: str = "active",
) -> DisplaySession:
    """
    创建一个“展示会话”（presentation session）

    参数：
    - session_type：类型（wireless / upload / hdmi）
    - device_type：设备类型（Windows / Mac / iPhone）
    - uploaded_file_id：关联的文件（如果是文件展示）
    - notes：备注
    - status：状态（默认 active）

    返回：
    - 创建后的 DisplaySession 对象

    用途：
    - 记录一次用户连接和展示行为
    - 后续可以用于分析或控制状态
    """
    db = SessionLocal()
    try:
        session = DisplaySession(
            session_type=session_type,
            started_at=datetime.now(),
            device_type=device_type,
            status=status,
            uploaded_file_id=uploaded_file_id,
            notes=notes,
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        return session
    finally:
        db.close()


def end_display_session(session_id: int) -> Optional[DisplaySession]:
    """
    结束一个展示会话

    操作：
    - 设置 session.status = "ended"
    - 设置结束时间 ended_at
    - 同时将 screen_state 切换回 billboard 模式

    参数：
    - session_id：要结束的 session ID

    返回：
    - 更新后的 session 对象（如果存在）

    用途：
    - 用户断开连接时调用
    - 自动切换回 idle / billboard 页面
    """
    db = SessionLocal()
    try:
        session = db.query(DisplaySession).filter(DisplaySession.id == session_id).first()

        if not session:
            return None

        session.status = "ended"
        session.ended_at = datetime.now()

        # 同时更新屏幕状态
        state = db.query(ScreenState).first()
        if state:
            state.mode = "billboard"
            state.current_session_id = None
            state.last_changed_at = datetime.now()

        db.commit()
        db.refresh(session)

        return session
    finally:
        db.close()


def get_current_or_next_booking() -> Tuple[Optional[BookingEvent], Optional[BookingEvent]]:
    """
    获取当前会议和下一个会议

    返回：
    - current_event：当前正在进行的会议
    - next_event：下一个即将开始的会议

    判断逻辑：
    - current_event：start_time <= now <= end_time
    - next_event：start_time > now，按时间排序取最早

    用途：
    - billboard 页面显示“当前会议 / 下一个会议”
    """
    db = SessionLocal()
    try:
        now = datetime.now()

        current_event = (
            db.query(BookingEvent)
            .filter(BookingEvent.start_time <= now)
            .filter(BookingEvent.end_time >= now)
            .order_by(BookingEvent.start_time.asc())
            .first()
        )

        next_event = (
            db.query(BookingEvent)
            .filter(BookingEvent.start_time > now)
            .order_by(BookingEvent.start_time.asc())
            .first()
        )

        return current_event, next_event
    finally:
        db.close()