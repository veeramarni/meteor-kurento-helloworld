/**
 * Created by veeramarni on 1/4/16.
 */
Meteor.publish('kurentoClientEvents', function(sessionId){
    return KurentoClientEvents.find({sessionId: sessionId});
})