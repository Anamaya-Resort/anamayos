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
  features: string;
  onClose: () => void;
}

export function RoomDetailModal({ room, images, description, features, onClose }: RoomDetailProps) {
  const [mainImage, setMainImage] = useState(images[0] ?? room.heroImage ?? '');

  return (
    <div className="bf-modal-overlay" onClick={onClose} style={{ zIndex: 9500 }}>
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
            {images.slice(0, 8).map((url, i) => (
              <div
                key={i}
                className="bf-room-detail-gallery-thumb"
                style={{ backgroundImage: `url(${url})` }}
                onClick={() => setMainImage(url)}
              />
            ))}
          </div>

          {/* Features bar */}
          {features && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {features.split(' -- ').map((f) => (
                <span key={f} className="bf-retreat-card-tag" style={{ fontSize: 10, padding: '3px 8px' }}>
                  {f.trim()}
                </span>
              ))}
            </div>
          )}

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
 * Room data from anamaya.com — images, descriptions, and features.
 * Keyed by lowercase room name prefix for matching.
 */
export const ROOM_DATA: Record<string, { images: string[]; description: string; features: string }> = {
  casita: {
    features: 'Ocean View -- AC -- Ceiling Fans -- Deck -- Hammocks -- 2 Bathrooms',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Property-20.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole16.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole8.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole14.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole15.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Casita_DuarteDellarole10.jpg',
    ],
    description: 'Casita used to be a small house on the property before Anamaya was built. It is now a large and lovely home for solo travelers, 5 friends, or anyone traveling on a budget. We have something for everyone in terms of affordability.\nThere is a large deck with hammocks and a seating area overlooking the ocean and the jungle, and it is well designed with high ceilings with a lot of natural light and airflow.\nWe call the Casita a dorm style room because it is a shared space, but this is unlike any dorm you\'ve seen. It is surrounded by organic herb and vegetable gardens, and has two bathrooms — including a very large garden bathroom and shower that our guests rave about and will often use it to take showers in the rain!\nThe Casita is the first structure that was built on this property so it is set apart from our other cabinas, offering a lot of space and privacy.',
  },
  garuda: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Hammocks -- 360° Views',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Property-19.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole8.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole9.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole10.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Garuda_DuarteDellarole11.jpg',
    ],
    description: 'We like to call this room the Sky Cabin, but some of our guests call it the Tree House. Whatever you would prefer to call it, Garuda is one of our more popular rooms.\nThis tower has the best views on the property!\nThis room is perfect for 2–4 people. On the lower level you have the option of 2 single beds or one King sized bed, and in the upper loft is one Queen sized bed.\nBelow the main cabin, halfway up the tower is your very own private deck and lookout for you to practice yoga, read a book or take an afternoon nap in one of the hammocks. This room is truly epic!',
  },
  anahata: {
    features: 'Ocean Views -- AC -- Ceiling Fan -- Desk -- Balconies',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/MasterSuite_DuarteDellarole9.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/MasterSuite_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/MasterSuite_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2018/12/4W-MasterSuite-2.jpg',
    ],
    description: 'This room accommodates 2–3 people with either 3 adult sized single beds, or 1 king and one single. This room used to be called the Master Suite because it used to be the master bedroom of the owners of the house, before the property became Anamaya Resort.\nThis room is now called Anahata after the heart chakra partially because it\'s in the heart of Anamaya on the second level of the main house. It has a gorgeous private balcony overlooking our epic ocean view. The room also has vaulted ceilings, a ton of closet space and a large bathroom.\nLike all of our rooms there are ceiling fans and air conditioning, but the room is very well insulated so our guests find they don\'t need to use the AC very much.',
  },
  bali: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Garden Bathroom -- Bathtub -- Deck -- Hammock',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/masthead10.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole10.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Bali.jpg',
    ],
    description: 'The Bali Cabina is probably one of the most popular rooms at Anamaya. It was designed in Bali, then disassembled, shipped to Costa Rica, and re-assembled here. This room has a spectacular garden bathroom and deck overlooking the ocean.\nThis room is perfect for couples, solo travelers, or two good friends. There can be two single beds or one King sized bed in this room.\nThe Bali house is a very exotic room and has three walls of glass with large curtains for privacy.\nFrom this room you can see the mainland of Costa Rica, all the way down to Jaco and Quepos. On a lucky day you may see dolphins or whales playing in the water, and most of the time you can hear the Montezuma Falls off in the distance.\nThe outdoor tropical bathrooms are a big hit here at Anamaya, and the Bali Cabina is one of the largest garden bathrooms. It is one of only two rooms that has a bathtub, and from the tub or shower you are treated to a breathtaking view through a unique round window.',
  },
  jungle: {
    features: 'Tree House Views -- AC -- Ceiling Fan -- Desk -- Outdoor Shower',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole9.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Jungle_DuarteDellarole10.jpg',
    ],
    description: 'The Jungle room is a huge favorite at Anamaya because it is unlike any other room. What is unique about this room is that it is built into the jungle canopy. This is the only room that doesn\'t have an ocean view, but the view from this room is epic!\nThe design and lighting in this room is stunning, with your very own open air shower and balcony. Your bed is surrounded by 3 walls of glass making you feel completely connected to nature. The windows and sliding doors can be opened for a natural refreshing breeze, but like all our rooms there is air conditioning and a ceiling fan.\nThis room is perfect for a solo traveller in a king sized bed, or two friends in 2 adult-sized single beds. There is also a beautiful outdoor shower, making it even more fun! Our guests have seen monkeys, anteaters, toucans, and many other tropical animals in the canopy.',
  },
  prana: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Deck -- Desk -- Hammock',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole9.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole11.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Prana_DuarteDellarole8.jpg',
    ],
    description: 'This room is a favorite with visiting couples and solo travelers. It\'s cozy and private, with incredible south-facing views of the ocean and southern Nicoya peninsula.\nPrana has a queen sized bed, and is unique because it has a view of both the sunrise and the sunset... as well as a distant vista of Cabo Blanco national park, located at the southernmost tip of the Nicoya Peninsula. On a rare day, you might be able to see a rainbow down inside the valley, coming from a waterfall that\'s hidden in there.\nThe room has air conditioning, a ceiling fan, and a large open closet that has a small desk with a gorgeous ocean view. There is also a private deck with a hammock offering a gorgeous view of the peninsula. Some of our guests have seen whales or dolphins in the ocean below.',
  },
  lotus: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Balcony -- Hammock',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole8.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Lotus_DuarteDellarole1.jpg',
    ],
    description: 'The Lotus Room is one of the most popular because of the views to the East and the South. It is perfect for a couple (with a king sized bed), or two friends traveling together (with two adult sized single beds).\nThe \'split king\' Moroccan-inspired beds are our own unique design, made in Costa Rica from cenizaro wood. We have a variety of high quality bedding and our linens are organic.\nThere is an open air closet, which is the best way to store clothing in the tropics, a desk for your laptop, and an outdoor deck with hammocks.\nThe panoramic ocean and jungle views from this cabina make it one of the favorites here at Anamaya.',
  },
  gaia: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Loft -- Hammocks',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Gaia_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2012/12/gaia-room-view.jpg',
    ],
    description: 'Gaia House is our largest shared accommodation with 5 beds spread across a lower main room and a cozy loft. It features stunning ocean views, a communal atmosphere, and is perfect for groups or solo travelers on a budget. Women only.\nThe lower level has 3 beds and the loft above has 2 more. There\'s a large bathroom and the space is bright and airy with high ceilings and natural ventilation.',
  },
  ananda: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Loft -- Deck',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole9.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole13.jpg',
    ],
    description: 'The Ananda Cabina is a beautiful triple-occupancy room with two queen beds on the main level and a loft bed above. It features a private bathroom, ocean views, and a peaceful setting in the lower section of the resort.\nThe cabina has a lovely deck and is surrounded by tropical gardens.',
  },
  hanuman: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Deck -- Hammock',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole9.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole10.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Hanuman_DuarteDellarole11.jpg',
    ],
    description: 'The Hanuman Room features two princess beds and a sofabed, accommodating up to 3 guests. It has a private bathroom and offers ocean views from the lower section of the resort.\nA charming and comfortable space with a lovely deck and hammock.',
  },
  ganesh: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Deck',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/joseph-ganesh-deck.jpg',
    ],
    description: 'The Ganesh Room is a double-occupancy private room with two queen beds. It features a private bathroom, a large deck with stunning ocean views, and is located in the lower section of the resort.\nOne of our most popular rooms, known for its spacious deck and gorgeous views.',
  },
  shiva: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Deck',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole8.jpg',
      'https://anamaya.com/wp-content/uploads/2019/09/Shiva_DuarteDellarole1-scaled.jpg',
    ],
    description: 'The Shiva Room features two queen beds with mountain and ocean views. It has a private bathroom and is located in the lower section of the resort.\nA spacious and comfortable double-occupancy room with a deck offering panoramic views.',
  },
  mantra: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Deck',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/09/Mantra_DuarteDellarole2-scaled.jpg',
      'https://anamaya.com/wp-content/uploads/2016/02/Mantra-Room-6-1000px.jpg',
    ],
    description: 'The Mantra Room is a private room with two queen beds. It features a private bathroom and peaceful atmosphere.\nLocated in the lower section of the resort with views of the tropical gardens and ocean.',
  },
  dharma: {
    features: 'AC -- Ceiling Fan -- Private Bathroom -- Unique Character',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/09/OwnersHouse_DuarteDellarole1-scaled.jpg',
    ],
    description: 'The Dharma Room is a private double-occupancy room with two beds. Originally the owner\'s house, it features unique character and a private bathroom.\nLocated in the lower section of the resort, it offers a cozy and intimate setting.',
  },
};

/** Get room data by matching the room name to the ROOM_DATA keys */
export function getRoomDetailData(roomName: string): { images: string[]; description: string; features: string } {
  const key = roomName.toLowerCase().split(' ')[0];
  return ROOM_DATA[key] ?? { images: [], description: '', features: '' };
}
