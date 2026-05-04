(function () {
  'use strict';

  var state = {
    token: localStorage.getItem('demoAccessToken') || '',
    userId: '',
    username: '',
    postId: '',
    conversationId: '',
    socket: null,
  };

  var sectionTitles = {
    health: 'Health',
    auth: 'Auth',
    users: 'Users',
    posts: 'Posts',
    reactions: 'Reactions',
    uploads: 'Uploads',
    notifications: 'Notifications',
    chat: 'Chat',
  };

  var tokenInput = document.getElementById('tokenInput');
  var tokenStatus = document.getElementById('tokenStatus');
  var responseTitle = document.getElementById('responseTitle');
  var responseOutput = document.getElementById('responseOutput');
  var socketStatus = document.getElementById('socketStatus');

  function init() {
    tokenInput.value = state.token;
    updateTokenStatus();
    bindNavigation();
    bindForms();
    bindButtons();
    hydrateSocketStatus();
  }

  function bindNavigation() {
    document.querySelectorAll('[data-section-target]').forEach(function (button) {
      button.addEventListener('click', function () {
        var target = button.getAttribute('data-section-target');
        document.querySelectorAll('[data-section-target]').forEach(function (item) {
          item.classList.toggle('is-active', item === button);
        });
        document.querySelectorAll('[data-section]').forEach(function (section) {
          section.classList.toggle('is-active', section.getAttribute('data-section') === target);
        });
        document.getElementById('activeTitle').textContent = sectionTitles[target] || target;
      });
    });
  }

  function bindForms() {
    document.querySelectorAll('form[data-action]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        runAction(form.getAttribute('data-action'), form);
      });
    });
  }

  function bindButtons() {
    document.querySelectorAll('button[data-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        runAction(button.getAttribute('data-action'), button.closest('form'));
      });
    });
  }

  async function runAction(action, form) {
    try {
      if (action === 'save-token') return saveToken();
      if (action === 'clear-token') return clearToken();
      if (action === 'clear-response') return clearResponse();
      if (action === 'health') return request('GET', '/health');
      if (action === 'register') return register(form);
      if (action === 'login') return login(form);
      if (action === 'me') return request('GET', '/auth/me', null, { requireToken: true });
      if (action === 'get-user') return request('GET', '/users/' + encode(formValue(form, 'id')));
      if (action === 'get-user-by-username') {
        return request('GET', '/users/username/' + encode(formValue(form, 'username')));
      }
      if (action === 'update-profile') return updateProfile(form);
      if (action === 'user-posts') return userPosts(form);
      if (action === 'create-post') return createPost(form);
      if (action === 'feed') return feed(form);
      if (action === 'get-post') return request('GET', '/posts/' + encode(formValue(form, 'id')));
      if (action === 'update-post') return updatePost(form);
      if (action === 'delete-post') return request('DELETE', '/posts/' + encode(formValue(form, 'id')), null, { requireToken: true });
      if (action === 'like-post') return request('POST', '/posts/' + encode(formValue(form, 'postId')) + '/like', null, { requireToken: true });
      if (action === 'unlike-post') return request('DELETE', '/posts/' + encode(formValue(form, 'postId')) + '/like', null, { requireToken: true });
      if (action === 'like-reply') return request('POST', '/replies/' + encode(formValue(form, 'replyId')) + '/like', null, { requireToken: true });
      if (action === 'unlike-reply') return request('DELETE', '/replies/' + encode(formValue(form, 'replyId')) + '/like', null, { requireToken: true });
      if (action === 'upload-image') return uploadImage(form);
      if (action === 'notifications') return notifications(form);
      if (action === 'mark-notification-read') return request('PATCH', '/notifications/' + encode(formValue(form, 'id')) + '/read', null, { requireToken: true });
      if (action === 'mark-all-notifications-read') return request('PATCH', '/notifications/read-all', null, { requireToken: true });
      if (action === 'direct-conversation') return directConversation(form);
      if (action === 'conversations') return conversations(form);
      if (action === 'messages') return messages(form);
      if (action === 'socket-connect') return connectSocket();
      if (action === 'socket-disconnect') return disconnectSocket();
      if (action === 'socket-join') return emitSocket('join_conversation', {
        conversationId: formValue(form, 'conversationId'),
      });
      if (action === 'socket-send') return emitSocket('send_message', {
        conversationId: formValue(form, 'conversationId'),
        clientMessageId: 'demo-' + Date.now(),
        text: formValue(form, 'text'),
      });
      if (action === 'socket-typing') return emitSocket('typing', {
        conversationId: formValue(form, 'conversationId'),
        isTyping: Boolean(form.elements.isTyping.checked),
      });
      if (action === 'socket-seen') return emitSocket('mark_seen', {
        conversationId: formValue(form, 'conversationId'),
        messageId: formValue(form, 'messageId'),
      });
      renderResult('Unknown action', { action: action });
    } catch (error) {
      renderResult('Client error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function register(form) {
    var body = compact({
      email: formValue(form, 'email'),
      username: formValue(form, 'username'),
      password: formValue(form, 'password'),
      displayName: formValue(form, 'displayName'),
    });
    var payload = await request('POST', '/auth/register', body);
    captureAuth(payload);
  }

  async function login(form) {
    var body = {
      identifier: formValue(form, 'identifier'),
      password: formValue(form, 'password'),
    };
    var payload = await request('POST', '/auth/login', body);
    captureAuth(payload);
  }

  function updateProfile(form) {
    return request('PATCH', '/users/me', compact({
      username: formValue(form, 'username'),
      displayName: formValue(form, 'displayName'),
      bio: formValue(form, 'bio'),
      avatarUrl: formValue(form, 'avatarUrl'),
    }), { requireToken: true });
  }

  function userPosts(form) {
    return request('GET', '/users/' + encode(formValue(form, 'id')) + '/posts' + queryString({
      limit: formValue(form, 'limit'),
      cursor: formValue(form, 'cursor'),
    }));
  }

  function createPost(form) {
    return request('POST', '/posts', compact({
      content: formValue(form, 'content'),
      mediaUrls: parseList(formValue(form, 'mediaUrls')),
    }), { requireToken: true }).then(capturePost);
  }

  function feed(form) {
    return request('GET', '/posts/feed' + queryString({
      limit: formValue(form, 'limit'),
      cursor: formValue(form, 'cursor'),
    }));
  }

  function updatePost(form) {
    return request('PATCH', '/posts/' + encode(formValue(form, 'id')), compact({
      content: formValue(form, 'content'),
      mediaUrls: parseList(formValue(form, 'mediaUrls')),
    }), { requireToken: true });
  }

  async function uploadImage(form) {
    ensureToken();
    var formData = new FormData();
    formData.append('type', formValue(form, 'type'));
    if (form.elements.file.files[0]) {
      formData.append('file', form.elements.file.files[0]);
    }

    var payload = await requestFormData('/uploads/image', formData);
    var url = findFirst(payload, ['secureUrl']);
    if (url) {
      renderResult('Upload saved', {
        note: 'Copy secureUrl into mediaUrls or avatarUrl.',
        secureUrl: url,
        response: payload,
      });
    }
  }

  function notifications(form) {
    return request('GET', '/notifications' + queryString({
      limit: formValue(form, 'limit'),
      cursor: formValue(form, 'cursor'),
      unreadOnly: form.elements.unreadOnly.checked ? 'true' : '',
    }), null, { requireToken: true });
  }

  function directConversation(form) {
    return request('POST', '/conversations/direct/' + encode(formValue(form, 'userId')), null, {
      requireToken: true,
    }).then(captureConversation);
  }

  function conversations(form) {
    return request('GET', '/conversations' + queryString({
      limit: formValue(form, 'limit'),
      cursor: formValue(form, 'cursor'),
    }), null, { requireToken: true }).then(captureConversation);
  }

  function messages(form) {
    return request('GET', '/conversations/' + encode(formValue(form, 'conversationId')) + '/messages' + queryString({
      limit: formValue(form, 'limit'),
      cursor: formValue(form, 'cursor'),
    }), null, { requireToken: true });
  }

  async function request(method, path, body, options) {
    options = options || {};
    if (options.requireToken) {
      ensureToken();
    }

    var fetchOptions = {
      method: method,
      headers: {},
    };

    if (state.token) {
      fetchOptions.headers.Authorization = 'Bearer ' + state.token;
    }

    if (body !== undefined && body !== null) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }

    var response = await fetch(path, fetchOptions);
    var payload = await parseResponse(response);
    renderResult(method + ' ' + path + ' -> ' + response.status, payload);
    captureCommon(payload);
    return payload;
  }

  async function requestFormData(path, formData) {
    var headers = {};
    if (state.token) {
      headers.Authorization = 'Bearer ' + state.token;
    }

    var response = await fetch(path, {
      method: 'POST',
      headers: headers,
      body: formData,
    });
    var payload = await parseResponse(response);
    renderResult('POST ' + path + ' -> ' + response.status, payload);
    captureCommon(payload);
    return payload;
  }

  async function parseResponse(response) {
    var text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (_error) {
      return text;
    }
  }

  function captureAuth(payload) {
    var token = findFirst(payload, ['accessToken']);
    if (token) {
      state.token = token;
      localStorage.setItem('demoAccessToken', token);
      tokenInput.value = token;
      updateTokenStatus();
    }
    captureCommon(payload);
  }

  function captureCommon(payload) {
    var data = payload && payload.data ? payload.data : payload;
    var userId = findFirst(data, ['user', 'id']) || findFirst(data, ['author', 'id']);
    var username = findFirst(data, ['user', 'username']) || findFirst(data, ['author', 'username']);
    var postId = findFirst(data, ['post', 'id']);
    var conversationId = findFirst(data, ['conversation', 'id']) || findFirst(data, ['conversationId']);

    if (data && data.id && data.username) {
      userId = data.id;
      username = data.username;
    }

    if (data && Array.isArray(data.items) && data.items[0]) {
      if (data.items[0].content !== undefined || data.items[0].mediaUrls !== undefined) {
        postId = data.items[0].id;
      }

      if (data.items[0].type && data.items[0].members) {
        conversationId = data.items[0].id;
      }
    }

    if (userId) state.userId = userId;
    if (username) state.username = username;
    if (postId) state.postId = postId;
    if (conversationId) state.conversationId = conversationId;
    fillKnownValues();
  }

  function capturePost(payload) {
    captureCommon(payload);
    return payload;
  }

  function captureConversation(payload) {
    captureCommon(payload);
    return payload;
  }

  function fillKnownValues() {
    document.querySelectorAll('[data-fill="userId"]').forEach(function (input) {
      if (!input.value && state.userId) input.value = state.userId;
    });
    document.querySelectorAll('[data-fill="username"]').forEach(function (input) {
      if (!input.value && state.username) input.value = state.username;
    });
    document.querySelectorAll('[data-fill="postId"]').forEach(function (input) {
      if (!input.value && state.postId) input.value = state.postId;
    });
    document.querySelectorAll('[data-fill="conversationId"]').forEach(function (input) {
      if (!input.value && state.conversationId) input.value = state.conversationId;
    });
  }

  function saveToken() {
    state.token = tokenInput.value.trim();
    if (state.token) {
      localStorage.setItem('demoAccessToken', state.token);
    } else {
      localStorage.removeItem('demoAccessToken');
    }
    updateTokenStatus();
    renderResult('Token saved', { hasToken: Boolean(state.token) });
  }

  function clearToken() {
    state.token = '';
    tokenInput.value = '';
    localStorage.removeItem('demoAccessToken');
    updateTokenStatus();
    renderResult('Token cleared', { hasToken: false });
  }

  function updateTokenStatus() {
    tokenStatus.textContent = state.token ? 'Token stored. Protected requests will include it.' : 'No token stored.';
  }

  function ensureToken() {
    if (!state.token) {
      throw new Error('This action requires a JWT. Register or login first.');
    }
  }

  function connectSocket() {
    if (!window.io) {
      renderResult('Socket.IO unavailable', {
        message: 'The Socket.IO browser client did not load from /socket.io-client/socket.io.min.js.',
      });
      return;
    }

    ensureToken();
    if (state.socket && state.socket.connected) {
      renderResult('Socket already connected', { socketId: state.socket.id });
      return;
    }

    state.socket = window.io({
      auth: { token: state.token },
      transports: ['websocket', 'polling'],
    });

    state.socket.on('connect', function () {
      hydrateSocketStatus();
      renderResult('Socket connected', { socketId: state.socket.id });
    });
    state.socket.on('disconnect', function (reason) {
      hydrateSocketStatus();
      renderResult('Socket disconnected', { reason: reason });
    });
    state.socket.on('connect_error', function (error) {
      hydrateSocketStatus();
      renderResult('Socket connect error', { message: error.message });
    });
    state.socket.on('new_message', function (payload) {
      renderResult('Socket event: new_message', payload);
    });
    state.socket.on('user_typing', function (payload) {
      renderResult('Socket event: user_typing', payload);
    });
    state.socket.on('message_seen', function (payload) {
      renderResult('Socket event: message_seen', payload);
    });
    state.socket.on('socket_error', function (payload) {
      renderResult('Socket event: socket_error', payload);
    });

    hydrateSocketStatus();
  }

  function disconnectSocket() {
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    hydrateSocketStatus();
    renderResult('Socket disconnected', { connected: false });
  }

  function emitSocket(eventName, payload) {
    if (!state.socket || !state.socket.connected) {
      throw new Error('Connect Socket.IO before emitting events.');
    }

    state.socket.emit(eventName, payload, function (ack) {
      renderResult('Socket ack: ' + eventName, ack);
      captureCommon(ack);
    });
  }

  function hydrateSocketStatus() {
    if (!socketStatus) return;
    var connected = Boolean(state.socket && state.socket.connected);
    socketStatus.textContent = connected ? 'Connected: ' + state.socket.id : 'Disconnected.';
  }

  function renderResult(title, payload) {
    responseTitle.textContent = title;
    responseOutput.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  }

  function clearResponse() {
    responseTitle.textContent = 'No request yet';
    responseOutput.textContent = 'Use a form or button to call the API.';
  }

  function formValue(form, name) {
    if (!form || !form.elements[name]) return '';
    return String(form.elements[name].value || '').trim();
  }

  function compact(input) {
    var output = {};
    Object.keys(input).forEach(function (key) {
      var value = input[key];
      if (Array.isArray(value)) {
        if (value.length > 0) output[key] = value;
        return;
      }
      if (value !== undefined && value !== null && value !== '') {
        output[key] = value;
      }
    });
    return output;
  }

  function parseList(value) {
    if (!value) return [];
    return value
      .split(',')
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function queryString(input) {
    var params = new URLSearchParams();
    Object.keys(input).forEach(function (key) {
      if (input[key] !== undefined && input[key] !== null && input[key] !== '') {
        params.set(key, input[key]);
      }
    });
    var value = params.toString();
    return value ? '?' + value : '';
  }

  function encode(value) {
    return encodeURIComponent(value);
  }

  function findFirst(value, path) {
    if (!value || !path.length) return null;

    var direct = path.reduce(function (current, key) {
      if (current && typeof current === 'object' && key in current) {
        return current[key];
      }
      return null;
    }, value);

    if (direct !== null && direct !== undefined && typeof direct !== 'object') {
      return direct;
    }

    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i += 1) {
        var fromArray = findFirst(value[i], path);
        if (fromArray) return fromArray;
      }
    }

    if (typeof value === 'object') {
      var keys = Object.keys(value);
      for (var j = 0; j < keys.length; j += 1) {
        var fromObject = findFirst(value[keys[j]], path);
        if (fromObject) return fromObject;
      }
    }

    return null;
  }

  init();
})();
