function attachSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join-screen-share-room', (data = {}) => {
      const room = String(data.room || '').trim();
      const role = String(data.role || '').trim();
      if (!room) {
        socket.emit('screen-share-error', { error: 'room is required' });
        return;
      }
      if (!['presenter', 'display', 'admin'].includes(role)) {
        socket.emit('screen-share-error', { error: 'role must be presenter, display, or admin' });
        return;
      }
      socket.join(room);
      const payload = {
        room,
        role,
        message: `${role} joined room ${room}`,
      };
      // Emit both names for demo + Flask parity during migration
      socket.emit('joined-screen-share-room', payload);
      socket.emit('screen-share-room-joined', payload);
      socket.to(room).emit('participant-joined', { room, role });
    });

    socket.on('leave-screen-share-room', (data = {}) => {
      const room = String(data.room || '').trim();
      const role = String(data.role || '').trim();
      if (!room) {
        socket.emit('screen-share-error', { error: 'room is required' });
        return;
      }
      socket.leave(room);
      socket.to(room).emit('participant-left', { room, role });
    });

    socket.on('screen-share-offer', (data = {}) => {
      const room = String(data.room || '').trim();
      if (!room) {
        socket.emit('screen-share-error', { error: 'room is required' });
        return;
      }
      socket.to(room).emit('screen-share-offer', data);
    });

    socket.on('screen-share-answer', (data = {}) => {
      const room = String(data.room || '').trim();
      if (!room) {
        socket.emit('screen-share-error', { error: 'room is required' });
        return;
      }
      socket.to(room).emit('screen-share-answer', data);
    });

    socket.on('ice-candidate', (data = {}) => {
      const room = String(data.room || '').trim();
      if (!room) {
        socket.emit('screen-share-error', { error: 'room is required' });
        return;
      }
      socket.to(room).emit('ice-candidate', data);
    });

    socket.on('stop-screen-share', (data = {}) => {
      const room = String(data.room || '').trim();
      if (!room) {
        socket.emit('screen-share-error', { error: 'room is required' });
        return;
      }
      socket.to(room).emit('stop-screen-share', data);
    });
  });
}

module.exports = { attachSocketHandlers };
