// js/call-addfriend.js
// Add Friend from active call — injects into existing call.js logic.
// ─────────────────────────────────────────────────────────────────

// Called when user taps "Add as Friend" during a call
function addFriendFromCall() {
  var btn  = document.getElementById('callAddFriendBtn');
  var text = document.getElementById('callAddFriendText');
  var pal  = state.currentPal;

  if (!pal) { showToast('No active call'); return; }

  // Already sent
  if (btn && btn.classList.contains('sent')) {
    showToast('Friend request already sent!');
    return;
  }

  // Build pal phone — may be available from match flow
  var palPhone = (pal.phone) || null;

  // Send the friend request via existing friends.js
  if (typeof sendFriendRequest === 'function') {
    sendFriendRequest(
      palPhone || ('call_' + Date.now()),
      pal.name     || 'Unknown',
      pal.avatar   || 'cat',
      pal.mood     || 'Happy',
      pal.moodEmoji || '😊'
    );
  } else {
    // Fallback: add directly to friends list
    if (typeof addFriendFromMatch === 'function') addFriendFromMatch(pal);
  }

  // Update button state
  if (btn)  btn.classList.add('sent');
  if (text) text.textContent = '✓ Request Sent!';
  showToast('👋 Friend request sent to ' + (pal.name || 'your pal') + '!');

  // If we have Firebase and their phone, push the request
  if (fbDb && palPhone && state.guftguPhone) {
    fbDb.ref('friendRequests/' + palPhone + '/' + state.guftguPhone).set({
      from:      state.guftguPhone,
      name:      state.user.nickname  || 'Anonymous',
      avatar:    state.user.avatar    || 'cat',
      mood:      state.user.mood      || 'Happy',
      moodEmoji: state.user.moodEmoji || '😊',
      timestamp: Date.now(),
      source:    'call'               // tag so they know it came from a call
    });
  }
}

// Reset the Add Friend button when a new call starts
// Hook into startVoiceCall — append reset logic
var _origStartVoiceCall = typeof startVoiceCall === 'function' ? startVoiceCall : null;
function _resetCallAddFriend() {
  var btn  = document.getElementById('callAddFriendBtn');
  var text = document.getElementById('callAddFriendText');
  if (btn)  btn.classList.remove('sent');
  if (text) text.textContent = 'Add as Friend';
}

// Patch startVoiceCall to reset button on each new call
document.addEventListener('DOMContentLoaded', function() {
  // Wait for call.js to define startVoiceCall, then wrap it
  var _orig = null;
  var _patched = false;
  function _tryPatch() {
    if (_patched) return;
    if (typeof startVoiceCall === 'function' && startVoiceCall !== _patched) {
      _orig = startVoiceCall;
      startVoiceCall = function(palOverride) {
        _resetCallAddFriend();
        return _orig.call(this, palOverride);
      };
      _patched = true;
    }
  }
  // Try immediately and after a tick
  _tryPatch();
  setTimeout(_tryPatch, 200);
  setTimeout(_tryPatch, 800);
});