'use client';

import { useState } from 'react';

interface RoomDetailProps {
  room: {
    name: string;
    category: string;
    maxOccupancy: number;
    isShared: boolean;
    ratePerNight: number | null;
    heroImage: string | null;
    description: string | null;
    beds: Array<{ label: string; bedType: string }>;
  };
  images: string[];
  description: string;
  onClose: () => void;
}

export function RoomDetailModal({ room, images, description, onClose }: RoomDetailProps) {
  const [mainImage, setMainImage] = useState(images[0] ?? room.heroImage ?? '');

  return (
    <div className="bf-modal-overlay" onClick={onClose}>
      <div className="bf-modal bf-room-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bf-modal-header">
          <h2>{room.name}</h2>
          <button onClick={onClose} className="bf-modal-close">×</button>
        </div>
        <div className="bf-modal-body">
          {/* Image gallery */}
          <div className="bf-room-detail-gallery">
            {mainImage && (
              <div
                className="bf-room-detail-gallery-main"
                style={{ backgroundImage: `url(${mainImage})` }}
              />
            )}
            {images.slice(0, 6).map((url, i) => (
              <div
                key={i}
                className="bf-room-detail-gallery-thumb"
                style={{ backgroundImage: `url(${url})` }}
                onClick={() => setMainImage(url)}
              />
            ))}
          </div>

          {/* Room info grid */}
          <div className="bf-room-detail-info">
            <div className="bf-room-detail-stat">
              <div className="bf-room-detail-stat-label">Category</div>
              <div className="bf-room-detail-stat-value">{room.category}</div>
            </div>
            <div className="bf-room-detail-stat">
              <div className="bf-room-detail-stat-label">Occupancy</div>
              <div className="bf-room-detail-stat-value">
                {room.maxOccupancy} {room.isShared ? 'beds' : 'guests'}
              </div>
            </div>
            {room.ratePerNight && (
              <div className="bf-room-detail-stat">
                <div className="bf-room-detail-stat-label">Rate</div>
                <div className="bf-room-detail-stat-value">${room.ratePerNight}/night</div>
              </div>
            )}
            <div className="bf-room-detail-stat">
              <div className="bf-room-detail-stat-label">Type</div>
              <div className="bf-room-detail-stat-value">{room.isShared ? 'Shared' : 'Private'}</div>
            </div>
          </div>

          {/* Beds */}
          {room.beds.length > 0 && (
            <div className="bf-room-detail-beds">
              {room.beds.map((b) => (
                <span key={b.label} className="bf-retreat-card-tag" style={{ fontSize: 10, padding: '2px 8px' }}>
                  {b.label} ({b.bedType})
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="bf-room-detail-description" style={{ marginTop: 16 }}>
            {description.split('\n').map((p, i) => (
              <p key={i} style={{ marginBottom: 8 }}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Room data from anamaya.com — images and descriptions.
 * Keyed by lowercase room name prefix for matching.
 */
export const ROOM_DATA: Record<string, { images: string[]; description: string }> = {
  casita: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole8.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole10.jpg',
    ],
    description: 'The Casita is our charming dormitory-style room that accommodates up to 5 women. Located in the upper section of the resort, it offers stunning ocean views and a cozy communal atmosphere. A great option for solo travelers looking to connect with other guests.',
  },
  garuda: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole8.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole9.jpg',
    ],
    description: 'The Garuda Tower is our most unique accommodation — a multi-level tower with lower and upper rooms, each with queen beds. The upper level offers panoramic 360-degree views of the ocean, jungle, and mountains. Features private bathrooms on each level and a stunning rooftop terrace.',
  },
  anahata: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/MasterSuite_DuarteDellarole9.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/MasterSuite_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/MasterSuite_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2018/12/4W-MasterSuite-2.jpg',
    ],
    description: 'The Anahata Room (Master Suite) is one of our premium rooms with expansive living space. It features center beds and a sofabed, private bathroom, and breathtaking ocean views. One of the most spacious and luxurious rooms at Anamaya.',
  },
  bali: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole10.jpg',
    ],
    description: 'The Bali Cabina is a beautiful Bali-inspired private cabina with two queen beds. It features a private bathroom, tropical gardens surrounding, and ocean views. Perfect for couples or friends sharing.',
  },
  jungle: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole9.jpg',
    ],
    description: 'The Jungle Cabina is immersed in the lush tropical jungle setting with beautiful nature views. It accommodates up to 3 guests and features a private bathroom. Wake up to the sounds of exotic birds and howler monkeys.',
  },
  prana: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole8.jpg',
    ],
    description: 'The Prana Cabina is a serene private cabina nestled in the tropical gardens with two queen beds. It features a private bathroom and beautiful views. A peaceful retreat within the retreat.',
  },
  lotus: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole8.jpg',
    ],
    description: 'The Lotus Cabina is a beautiful private cabina with two beds. It offers ocean views, a private bathroom, and a tranquil setting surrounded by tropical plants and flowers.',
  },
  gaia: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole6.jpg',
    ],
    description: 'Gaia House is our largest shared accommodation with 5 beds spread across a lower main room and a loft. It features stunning ocean views, a communal atmosphere, and is perfect for groups or solo travelers. Women only.',
  },
  ananda: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole9.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole13.jpg',
    ],
    description: 'The Ananda Cabina is a beautiful triple-occupancy room with two queen beds on the main level and a loft bed. It features a private bathroom, ocean views, and a peaceful setting in the lower section of the resort.',
  },
  hanuman: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole7.jpg',
    ],
    description: 'The Hanuman Room features two princess beds and a sofabed, accommodating up to 3 guests. It has a private bathroom and offers ocean views from the lower section of the resort. A charming and comfortable space.',
  },
  ganesh: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole7.jpg',
    ],
    description: 'The Ganesh Room is a double-occupancy private room with two queen beds. It features a private bathroom, a deck with ocean views, and is located in the lower section of the resort. One of our most popular rooms.',
  },
  shiva: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole8.jpg',
    ],
    description: 'The Shiva Room features two queen beds with mountain and ocean views. It has a private bathroom and is located in the lower section of the resort. A spacious and comfortable double-occupancy room.',
  },
  mantra: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole7.jpg',
    ],
    description: 'The Mantra Room is a private room with two queen beds. It features a private bathroom and peaceful atmosphere. Located in the lower section of the resort with views of the tropical gardens.',
  },
  dharma: {
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole6.jpg',
    ],
    description: 'The Dharma Room is a private double-occupancy room with two beds. Originally the owner\'s house, it features unique character, a private bathroom, and is located in the lower section of the resort.',
  },
};

/** Get room data by matching the room name to the ROOM_DATA keys */
export function getRoomDetailData(roomName: string): { images: string[]; description: string } {
  const key = roomName.toLowerCase().split(' ')[0];
  return ROOM_DATA[key] ?? { images: [], description: '' };
}
