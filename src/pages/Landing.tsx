import './landing.css';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className='landing'>
      <h1 className='title'>RedByteOS</h1>
      <p className='tagline'>A cyber-crafted neon operating system built for the future of the web.</p>
      <Link to='/os' className='launch-btn'>Launch OS</Link>
    </div>
  );
}

