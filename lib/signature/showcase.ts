// LeaseStack Signature: the builds shown on /signature. Each one is a live site the page embeds on request.
// A new build is one entry here plus one host in the frame-src list in next.config.mjs.

export const SIGNATURE_NAME = "LeaseStack Signature";

export type ShowcaseView = {
  label: string;
  /** Full address of the live page. */
  url: string;
  /** Screenshot shown until the visitor asks for the live build (public/signature). */
  poster: string;
  posterW: number;
  posterH: number;
  alt: string;
};

/** A silent screen recording of the build in use. It streams from the build's own host (media-src in next.config.mjs). */
export type Reel = {
  src: string;
  /** A lighter encode for phones. */
  srcSmall: string;
  poster: string;
  w: number;
  h: number;
};

export type ShowcaseEntry = {
  key: string;
  name: string;
  kind: string;
  place: string;
  /** "Concept" = built by us to show the product; the property is not a client. */
  status: "Concept" | "Client";
  line: string;
  facts: [string, string][];
  /** Shown under a concept build so nobody reads it as an endorsement. */
  note?: string;
  reel?: Reel;
  views: ShowcaseView[];
};

export const SHOWCASE: ShowcaseEntry[] = [
  {
    key: "ritz-portland",
    name: "The Ritz-Carlton Residences, Portland",
    kind: "Branded residences and hotel",
    place: "Portland, Oregon",
    status: "Concept",
    line: "A 35-story tower you can open floor by floor, and a private page for each residence on the market.",
    facts: [
      ["Residences with a page", "14"],
      ["Spaces to walk through", "16"],
      ["Generated images on a home page", "0"],
    ],
    note: "Concept build made from publicly published material. Not affiliated with or endorsed by The Ritz-Carlton Hotel Company, Marriott International or the owner of The Residences.",
    reel: {
      src: "https://theritzpdx.vercel.app/reel/tour-1280.mp4",
      srcSmall: "https://theritzpdx.vercel.app/reel/tour-768.mp4",
      poster: "/signature/ritz-tour.webp",
      w: 1280,
      h: 750,
    },
    views: [
      { label: "The tower", url: "https://theritzpdx.vercel.app/", poster: "/signature/ritz-tower.webp", posterW: 1600, posterH: 1000, alt: "The tower at dusk with a directory of its 35 floors" },
      { label: "Homes for sale", url: "https://theritzpdx.vercel.app/homes", poster: "/signature/ritz-list.webp", posterW: 1600, posterH: 1000, alt: "Fourteen residences as cards beside the tower drawn floor by floor" },
      { label: "One residence", url: "https://theritzpdx.vercel.app/homes/2810", poster: "/signature/ritz-home.webp", posterW: 1600, posterH: 878, alt: "The page for one residence: its living room, its facts and its floor lit on the tower" },
      { label: "For the sales team", url: "https://theritzpdx.vercel.app/homes/send", poster: "/signature/ritz-send.webp", posterW: 1600, posterH: 670, alt: "A page where an agent picks a residence and names the buyer to get a link" },
    ],
  },
  {
    key: "fernwood",
    name: "The Fernwood",
    kind: "Furnished apartments",
    place: "Seattle, Washington",
    status: "Concept",
    line: "Pick a floor on the building, see what is open on it, and step into the plan in three dimensions.",
    facts: [
      ["Homes", "64"],
      ["Floors to pick from", "6"],
      ["Plans, room by room", "3D"],
    ],
    note: "A fictional property, built to show the product on a mid-rise apartment building.",
    views: [
      { label: "The building", url: "https://fernwood-demo.vercel.app/", poster: "/signature/fernwood.webp", posterW: 1600, posterH: 1000, alt: "A six-story apartment building with a floor picker listing the homes open on level six" },
    ],
  },
];

/** What every build includes, each shown with a real screen from a build above. */
export const INCLUDED: { title: string; line: string; img: string; w: number; h: number; alt: string; /** show the whole screen instead of filling the tile */ whole?: boolean }[] = [
  { title: "A page for every residence", line: "One link to text. It opens on that home, its floor lit on the tower.", img: "/signature/ritz-home.webp", w: 1600, h: 878, alt: "A residence page with photograph, facts and the tower" },
  { title: "The building, floor by floor", line: "What is available, reserved and sold, on the building itself.", img: "/signature/ritz-list.webp", w: 1600, h: 1000, alt: "Residences as cards beside a floor-by-floor grid of the tower" },
  { title: "Room by room", line: "Your photography, in order, labelled with where it was taken.", img: "/signature/ritz-room.webp", w: 1600, h: 858, alt: "A kitchen photograph in the room-by-room viewer" },
  { title: "The measured plan", line: "The plan of that exact home, not a typical layout.", img: "/signature/ritz-plan.webp", w: 1000, h: 1293, alt: "A measured floor plan with room dimensions", whole: true },
  { title: "A link with their name on it", line: "Your team picks a home, adds a first name, and copies the link.", img: "/signature/ritz-send.webp", w: 1600, h: 670, alt: "The link builder: a list of residences, a name field and the finished link", whole: true },
  { title: "What they looked at", line: "Each enquiry arrives with the homes and rooms that person opened.", img: "/signature/ritz-enquiry.webp", w: 1200, h: 551, alt: "An enquiry showing the buyer, the residence and the rooms viewed", whole: true },
];

export const COMPARE: [string, string, string][] = [
  ["What you send a buyer", "The website, and a PDF", "A page for that one home, with their name on it"],
  ["Floor plans", "A typical layout per plan type", "The measured plan of the exact residence"],
  ["Where it is in the building", "A unit number", "Its floor lit on the building, with what is around it"],
  ["Availability", "A table that goes stale", "The building itself, floor by floor"],
  ["An enquiry", "A name and an email", "The homes and rooms that person opened, and for how long"],
  ["Where leads end up", "An inbox", "Your LeaseStack dashboard, with the source"],
];

export const FOR_WHOM: [string, string][] = [
  ["Branded residences", "Condominium sell-downs where every remaining home needs its own case."],
  ["Luxury rentals", "Lease-ups and stabilized towers with premium floors and penthouses."],
  ["Hotels and resorts", "Suites, villas and event spaces a guest can walk before they book."],
  ["Timeshare and fractional", "Show the residence and the week, to a buyer who is somewhere else."],
  ["Senior living", "Let a family tour the apartment and the community from home."],
];

export const STEPS: [string, string][] = [
  ["We build it from what you have", "Your plans, your photography and your availability. No new shoot to start."],
  ["It goes live beside your site", "On its own address, private until you choose to publish it."],
  ["Your team sends links", "One home, one buyer, one link. No training beyond that."],
  ["Interest shows up in LeaseStack", "Every enquiry lands in your dashboard with what that person looked at."],
];

export const FAQ: [string, string][] = [
  ["Do we need new photography or renderings?", "No. A build starts from the plans and photography you already have. Where a home has none, we show the measured plan and the view, and say so."],
  ["Is any of it generated?", "The pages for individual homes use your own photography and plans only, shown as taken. Atmosphere on the building view, such as a dusk version of the tower, is offered separately and labelled."],
  ["Does it replace our website?", "No. It sits beside it on its own address. Your site keeps doing its job; this is what your team sends once a conversation has started."],
  ["How is it priced?", "Per property, as an add-on to a LeaseStack plan. Book a demo and we will quote your building."],
];
