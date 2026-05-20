from flask_socketio import join_room, leave_room, emit

from extensions import socketio


@socketio.on("join-screen-share-room")
def handle_join_screen_share_room(data):
    """
    presenter or display add screen share room。
    """
    room = str(data.get("room", "")).strip()
    role = str(data.get("role", "")).strip()

    if not room:
        emit("screen-share-error", {"error": "room is required"})
        return

    if role not in ("presenter", "display", "admin"):
        emit("screen-share-error", {"error": "role must be presenter, display, or admin"})
        return

    join_room(room)

    emit(
        "joined-screen-share-room",
        {
            "room": room,
            "role": role,
            "message": f"{role} joined room {room}",
        },
    )

    emit(
        "participant-joined",
        {
            "room": room,
            "role": role,
        },
        to=room,
        include_self=False,
    )


@socketio.on("leave-screen-share-room")
def handle_leave_screen_share_room(data):
    """
    presenter or display leave screen share room。
    """
    room = str(data.get("room", "")).strip()
    role = str(data.get("role", "")).strip()

    if not room:
        emit("screen-share-error", {"error": "room is required"})
        return

    leave_room(room)

    emit(
        "participant-left",
        {
            "room": room,
            "role": role,
        },
        to=room,
        include_self=False,
    )


@socketio.on("screen-share-offer")
def handle_screen_share_offer(data):
    """
    After Presenter create offer ，backend sent it to Display。
    """
    room = str(data.get("room", "")).strip()

    if not room:
        emit("screen-share-error", {"error": "room is required"})
        return

    emit(
        "screen-share-offer",
        data,
        to=room,
        include_self=False,
    )


@socketio.on("screen-share-answer")
def handle_screen_share_answer(data):
    """
    After display create answer ，backend send it to Presenter。
    """
    room = str(data.get("room", "")).strip()

    if not room:
        emit("screen-share-error", {"error": "room is required"})
        return

    emit(
        "screen-share-answer",
        data,
        to=room,
        include_self=False,
    )


@socketio.on("ice-candidate")
def handle_ice_candidate(data):
    """
    exchange ICE candidate。
    """
    room = str(data.get("room", "")).strip()

    if not room:
        emit("screen-share-error", {"error": "room is required"})
        return

    emit(
        "ice-candidate",
        data,
        to=room,
        include_self=False,
    )


@socketio.on("stop-screen-share")
def handle_stop_screen_share(data):
    """
    If one side end screen share，inform other side in the room。
    """
    room = str(data.get("room", "")).strip()

    if not room:
        emit("screen-share-error", {"error": "room is required"})
        return

    emit(
        "stop-screen-share",
        data,
        to=room,
        include_self=False,
    )