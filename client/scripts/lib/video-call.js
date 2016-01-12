/**
 * Created by veeramarni on 1/3/16.
 */

VideoCall = function () {
    const I_CAN_START = 0;
    const I_CAN_STOP = 1;
    const I_AM_STARTING = 2;
    var self = this;
    self.videoInput = null;
    self.videoOutput = null;
    self.webRtcPeer = null;
    self.file_uri = null;


    // private functions
    self._onOffer = onOffer;
    self._onError = onError;
    self._onIceCandidate = onIceCandidate;
    self._onPlayOffer = onPlayOffer;
    self._onResponse = onResponse;
    self._setState = setState;

    // constants
    self.I_CAN_START = I_CAN_START;
    self.I_CAN_STOP = I_CAN_STOP;
    self.I_AM_STARTING = I_AM_STARTING;

    // load
    Session.set('sessionId', Meteor.uuid());
    setState(I_CAN_START);


    //Methods

    function setState(nextState) {
        switch (nextState) {
            case I_CAN_START:
                $('#start').attr('disabled', false)
                $('#stop').attr('disabled', true);
                $('#play').attr('disabled', false);
                break;
            case I_CAN_STOP:
                $('#start').attr('disabled', false);
                $('#stop').attr('disabled', false);
                $('#play').attr('disabled', false);
                break;

            case I_AM_STARTING:
                $('#start').attr('disabled', false);
                $('#stop').attr('disabled', false);
                $('#play').attr('disabled', true);
        }
    }
    function onOffer(error, offerSdp) {
        if (error)
            return onError(error);

        Meteor.call('onOffer', Session.get('sessionId'), offerSdp, self.file_uri, onResponse);
    }
    function onIceCandidate(candidate) {
        var newCandidate = JSON.parse(JSON.stringify(candidate));
        self.webRtcPeer.peerConnection.getStats(getStats);
        console.log('Local candidate' + JSON.stringify(newCandidate));
        Meteor.call('onIceCandidate', Session.get('sessionId'), newCandidate);
    }

    function onError(error) {
        console.log(error);
    }

    function onPlayOffer(error, plyOfferSdp) {
        if (error)
            return onError(error);

        Meteor.call('onPlayOffer', Session.get('sessionId'), plyOfferSdp, self.file_uri, onResponse);
    }

    function getStats(stats) {

        var results = stats.result();

        for (var i = 0; i < results.length; i++) {
            var res = results[i];
            if (res.type != 'ssrc') continue;
            //Publish it to be compliant with W3C stats draft
            var retVal = {
                timeStamp: res.timestamp,
                //StreamStats below
                associateStatsId: res.id,
                codecId: "--",
                firCount: res.stat('googFirsReceived'),
                isRemote: false,
                mediaTrackId: res.stat('googTrackId'),
                nackCount: res.stat('googNacksReceived'),
                pliCount: res.stat('googPlisReceived'),
                sliCount: 0,
                ssrc: res.stat('ssrc'),
                transportId: res.stat('transportId'),
                //Specific outbound below
                bytesSent: res.stat('bytesSent'),
                packetsSent: res.stat('packetsSent'),
                roundTripTime: res.stat('googRtt'),
                packetsLost: res.stat('packetsLost'),
                targetBitrate: "??",
                remb: "??"
            };
            console.log(JSON.stringify(retVal));
        }
    }

    function onResponse(error, answerSdp) {
        if (error) {
            onError(error);
        }
        self._setState(I_CAN_STOP);
        console.log('SDP answer received from server. Processing ...' + answerSdp);
        self.webRtcPeer.processAnswer(answerSdp);
    }
};


_.extend(VideoCall.prototype, {
    start: function (file_uri) {
        var self = this;
        self.file_uri = file_uri;

        var options = {
            localVideo: self.videoInput,
            remoteVideo: self.videoOutput,
            onicecandidate: self._onIceCandidate
        };
        self.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
            if (error)
                return onError(error);
            this.peerConnection.getStats(function (result) {
                result.result().forEach(function (res) {
                    console.log(JSON.stringify(res));
                });
            });
            this.generateOffer(self._onOffer);
        })

    },
    stop: function () {
        console.log('Stopping video call...');
        var self = this;
        self._setState(self.I_CAN_START);

        if (self.webRtcPeer) {
            self.webRtcPeer.dispose();
            self.webRtcPeer = null;

            Meteor.call('onStop', Session.get('sessionId'));
        }

    },
    iceCandidate: function (candidate) {
        var self = this;
        console.log('Remote candidate' + JSON.stringify(candidate));
        self.webRtcPeer.addIceCandidate(candidate);
    },
    play: function (file_uri) {
        var self = this;
        self.file_uri = file_uri;

        var options = {
            localVideo: self.videoInput,
            remoteVideo: self.videoOutput,
            onicecandidate: self._onIceCandidate
        };
        self.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
            if (error)
                return onError(error);

            this.generateOffer(self._onPlayOffer);
        });
    }

});

