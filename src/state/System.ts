export function getSystemStats() {
  return {
    cpu: Math.floor(Math.random() * 60) + 30,
    ram: Math.floor(Math.random() * 50) + 20,
    temp: Math.floor(Math.random() * 40) + 40,
  };
}

