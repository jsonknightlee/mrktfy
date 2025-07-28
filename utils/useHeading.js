import { useEffect, useState } from 'react';
import { Magnetometer } from 'expo-sensors';

function angleFromMagnetometer({ x, y }) {
  let angle = Math.atan2(y, x);
  angle = angle * (180 / Math.PI); // convert to degrees
  if (angle < 0) angle += 360;
  return angle;
}

export function useHeading() {
  const [heading, setHeading] = useState(null);

  useEffect(() => {
    const subscription = Magnetometer.addListener((data) => {
      const angle = angleFromMagnetometer(data);
      setHeading(angle);
    });

    Magnetometer.setUpdateInterval(500); // update twice per second

    return () => {
      subscription.remove();
    };
  }, []);

  return heading;
}
