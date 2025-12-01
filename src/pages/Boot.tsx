import './boot.css';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Boot() {
  const nav = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => nav('/os'), 1500);
    return () => clearTimeout(t);
  }, []);
  
  return (
    <div className='boot-screen'>
      <div className='boot-text'>Initializing RedByteOS...</div>
    </div>
  );
}

