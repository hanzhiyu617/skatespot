import deleteSpotHandler from '../../../netlify/functions/admin-delete.mjs';

export default {
  fetch(request) {
    let id = '';
    try {
      id = decodeURIComponent(new URL(request.url).pathname.split('/').pop() || '');
    } catch {
      id = '';
    }
    return deleteSpotHandler(request, { params: { id } });
  }
};
