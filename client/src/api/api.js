import axios from 'axios';

const API = axios.create({
  baseURL: 'https://supreme-yodel-pvx5ggjggqp37q6j-5000.app.github.dev/api',
});

// Attach token automatically
API.interceptors.request.use((req) => {
  const user = JSON.parse(localStorage.getItem('user'));

  if (user?.token) {
    req.headers.Authorization = `Bearer ${user.token}`;
  }

  return req;
});

export default API;