window.EgressHelper = {
    currentRoom: null,
    async onPageLoad(livekitURL, livekitToken) {
        const room = new LivekitClient.Room();
        await room.connect(livekitURL, livekitToken);
        EgressHelper.setRoom(room);
        const intervalId = setInterval(function () {
            switch (room.state) {
                case LivekitClient.ConnectionState.Connected: {
                    if (!room.isRecording) {
                        EgressHelper.startRecording();
                    }
                }
                    break;
                case LivekitClient.ConnectionState.Disconnected: {
                    if (room.isRecording) {
                        EgressHelper.endRecording();
                        clearInterval(intervalId);
                    }
                }
                    break;
            }
        }, 1000)
    },
    setRoom(room, opts) {
        if (EgressHelper.currentRoom) {
            EgressHelper.currentRoom.off(LivekitClient.RoomEvent.ParticipantDisconnected, EgressHelper.onParticipantDisconnected);
            EgressHelper.currentRoom.off(LivekitClient.RoomEvent.Disconnected, EgressHelper.endRecording);
        }

        EgressHelper.currentRoom = room;
        if (opts?.autoEnd) {
            EgressHelper.currentRoom.on(LivekitClient.RoomEvent.ParticipantDisconnected, EgressHelper.onParticipantDisconnected);
        }
        EgressHelper.currentRoom.on(LivekitClient.RoomEvent.Disconnected, EgressHelper.endRecording);
    },

    startRecording() {
        console.log('START_RECORDING');
    },
    endRecording() {
        EgressHelper.currentRoom = undefined;
        console.log('END_RECORDING');
    },

    onParticipantDisconnected() {
        if (EgressHelper.currentRoom) {
            if (EgressHelper.currentRoom.participants.size === 0) {
                EgressHelper.endRecording();
            }
        }
    },
}
