import { useEffect } from 'react';
import socket from './socket';

useEffect(() => {
  socket.on('orderUpdated', (data) => {
    console.log('Order updated:', data);
  });

  return () => {
    socket.off('orderUpdated');
  };
}, []);