import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useMap } from 'react-leaflet';

function MapUpdater({ position }) {
  const map = useMap();

  map.setView(position, 13);

  return null;
}
function LocationPicker({ setForm, setPosition }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;

      setForm((prev) => ({
        ...prev,
        lat,
        lng,
      }));

      // ✅ move marker
      setPosition([lat, lng]);
    },
  });

  return null;
}

export default function MapComponent({ setForm, position, setPosition }) {
  return (
    <div style={{ height: '400px', width: '100%' }}>
      <MapContainer
        center={position}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater position={position}/>
        {/* ✅ Marker */}
        <Marker position={position} />

        {/* ✅ Click handler */}
        <LocationPicker setForm={setForm} setPosition={setPosition} />
      </MapContainer>
    </div>
  );
}