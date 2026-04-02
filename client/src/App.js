import axios from 'axios';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const API = process.env.REACT_APP_API_URL;

    axios.get(`${API}/`)
      .then(res => console.log(res.data))
      .catch(err => console.error(err));
  }, []);

  return <div>Check console</div>;
}

export default App;