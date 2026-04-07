import { useState } from 'react';
import API from '../api/api';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await API.post('/auth/register', form);
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 max-w-md mx-auto">
      <h2 className="text-xl mb-4">Register</h2>

      <input
        placeholder="Name"
        className="w-full mb-3 p-2 text-black"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <input
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
        Register
      </button>
    </form>
  );
}