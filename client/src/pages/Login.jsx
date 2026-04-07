import { useState, useContext } from 'react';
import API from '../api/api';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const { data } = await API.post('/auth/login', form);
      login(data);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 max-w-md mx-auto">
      <h2 className="text-xl mb-4">Login</h2>

      <input
        type="email"
        placeholder="Email"
        className="w-full mb-3 p-2 text-black"
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

      <input
        type="password"
        placeholder="Password"
        className="w-full mb-3 p-2 text-black"
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />

      <button className="bg-white text-black px-4 py-2 w-full">
        Login
      </button>
    </form>
  );
}