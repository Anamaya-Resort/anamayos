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
    features: 'Ocean View -- AC -- Ceiling Fan -- 2 Lofts -- Sliding Glass Doors -- 2 Bathrooms',
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
    description: 'Gaia House accommodates up to five people and has three single beds on the lower level and two separate loft areas, each with a single bed. The entire front of the Gaia House features sliding glass and screen doors that can all be opened for maximum breeze and light. Both dorms have full ocean views.\nGaia has 2 bathrooms, each with a toilet and sink, 2 open-air showers with curtains for privacy, and 3 sinks total. The lower level can also be configured as 1 king + twin beds.',
  },
  ananda: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Bathtub -- Private Deck -- Hammock -- Zen Garden -- Loft',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole9.jpg',
      'https://anamaya.com/wp-content/uploads/2019/07/Ananda_DuarteDellarole13.jpg',
    ],
    description: 'The Ananda Cabina is the resort\'s most spectacular accommodation, with the most amazing ocean views, great privacy, and a large beautiful bathtub. This bright and spacious cabina has many windows to let in maximum light and airflow.\nOne of the key features of this room is the open-air bathroom with a sculpted circular tub looking over the epic ocean view. There is also a desk, private deck, and hammock. Ananda also has a hidden zen garden that helps to add even more beauty and create a very peaceful space.\nThis room has a small loft area as an additional reading/lounging/napping space. Like most of the other rooms, the Ananda has two single beds that are extra 10 centimeters long for adults (the same length as a king-size bed), and when put together, they can make a king bed for couples.',
  },
  hanuman: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Private Deck -- Hammock -- Niche Bed Design -- Open-Air Bathroom',
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
    description: 'The Hanuman Cabina sleeps 2-4 people and is one of the guests\' favorites because of the uniquely designed queen-sized bed built into its own special niche. Like all of the resort\'s rooms, it has air conditioning and a ceiling fan, and a beautiful private deck to take in the view, enjoy the hammock, or read one of your favorite books.\nHanuman is ideal for 2 friends who will have their own luxurious beds. The cabina is named for the monkeys frequently seen in the canopy in front of it. The room has a beautiful view of the ocean and an open-air designer bathroom.',
  },
  ganesh: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Private Tower -- Open-Air Bathroom -- Deck with Hammock -- Sunrise & Sunset Views',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/Ganesh_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/12/joseph-ganesh-deck.jpg',
    ],
    description: 'The Ganesh Room is a favorite with visiting couples and solo travelers. It is cozy and private, with incredible south-facing views of the ocean and southern Nicoya peninsula.\nThe room offers views of both the sunrise and sunset, as well as a distant view of Cabo Blanco National Park. Some guests have reported seeing whales or dolphins in the ocean below in front of the Rio Montezuma river mouth.\nThis is a lovely cabina that comes with your own private tower, amazing jungle and ocean views, and a unique open-air bathroom. The Ganesh bathroom has a spectacular view open to the ocean and the jungle below. The room includes a small desk with a gorgeous ocean view, and there is a deck above with a hammock.',
  },
  shiva: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Deck -- Desk -- Hammock -- Eco-Friendly',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole1.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Shiva_DuarteDellarole8.jpg',
      'https://anamaya.com/wp-content/uploads/2019/09/Shiva_DuarteDellarole1-scaled.jpg',
    ],
    description: 'The Shiva Room is ideal for couples or solo travellers. It is cozy and private, with views of the ocean and a large tree that often has monkeys in it.\nThe room is designed using environmentally friendly products and building practices, and features organic linens. All rooms have ceiling fans, air conditioning, and organic linens.',
  },
  mantra: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Balcony -- Hammock -- Exceptional Privacy',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole5.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/Mantra_DuarteDellarole7.jpg',
      'https://anamaya.com/wp-content/uploads/2019/09/Mantra_DuarteDellarole2-scaled.jpg',
      'https://anamaya.com/wp-content/uploads/2016/02/Mantra-Room-6-1000px.jpg',
    ],
    description: 'The Mantra Room has a ton of privacy and an amazing ocean view. It is located underneath the lower yoga deck, making it one of the most private rooms at the resort.\nThe room has a perfect view of a large tree that is a favorite amongst the monkeys. It features a queen-sized bed and a large private bathroom. Perfect for a solo traveler.',
  },
  dharma: {
    features: 'Ocean View -- AC -- Ceiling Fan -- Exceptional Privacy',
    images: [
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole2.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole3.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole4.jpg',
      'https://anamaya.com/wp-content/uploads/2019/08/OwnersHouse_DuarteDellarole6.jpg',
      'https://anamaya.com/wp-content/uploads/2019/09/OwnersHouse_DuarteDellarole1-scaled.jpg',
    ],
    description: 'The Dharma Room is located underneath the second yoga deck, next to the Mantra Room, and is one of the most private rooms at the resort. It has a great ocean view, and a big tree in front that is a favorite of local monkey troupes.\nThis is a very private room perfect for a couple or two friends. Choice of either a king-sized bed or 2 adult-sized single beds.',
  },
};

/** Get room data by matching the room name to the ROOM_DATA keys */
export function getRoomDetailData(roomName: string): { images: string[]; description: string; features: string } {
  const key = roomName.toLowerCase().split(' ')[0];
  return ROOM_DATA[key] ?? { images: [], description: '', features: '' };
}
