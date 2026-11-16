/** Green Airways flight search: shapes shared by the server, the API and the page. */

export interface Airport {
  code: string;
  name: string;
  /** Green Airways' own id for the airport (their booking engine needs it). */
  dataId: number;
}

export interface GreenAirConfig {
  airports: Airport[];
  /** Origin code -> the destinations Green Airways flies to from there. */
  routes: Record<string, string[]>;
}

export interface SearchParams {
  from: string;
  to: string;
  /** YYYY-MM-DD, Costa Rica date. */
  depart: string;
  /** YYYY-MM-DD; absent for one way. */
  return?: string;
  adults: number;
}

export interface Fare {
  /** LIGHT, FLEX, STANDARD, PREMIUM... */
  family: string;
  /** US dollars per person. */
  price: number | null;
  features: string[];
  available: boolean;
}

export interface Flight {
  flightNo: string;
  from: string;
  to: string;
  /** HH:MM local (Costa Rica). */
  depart: string;
  arrive: string;
  duration: string;
  stops: string;
  aircraft: string | null;
  fromPrice: number | null;
  fares: Fare[];
}

export interface DayPrice {
  date: string;
  fromPrice: number | null;
}

export interface Trip {
  from: string;
  to: string;
  date: string;
  days: DayPrice[];
  flights: Flight[];
}

export interface SearchResult {
  trips: Trip[];
  /** ISO time the prices were read from Green Airways. */
  checkedAt: string;
  /** Opens the same search on Green Airways' own site, where the guest books and pays. */
  bookingUrl: string;
}
