// Marketing-site copy and image slots. Images are loaded from /public/site/... - drop a
// file at the matching path and it replaces the placeholder automatically (SiteImage
// falls back to a toned placeholder while a file is missing). Project titles below are
// placeholders until the real project list is provided.

export const SITE = {
  name: 'Navish',
  descriptor: 'Architect & Builders',
  email: 'navishstudioarchitects@gmail.com',
  tagline: 'Quiet architecture shaped by true stories',
};

const img = (path: string) => `/site/${path}.jpg`;

export interface Project {
  slug: string;
  title: string;
  type: string;
  image: string;
  detail: string;
}

export const projects: Project[] = Array.from({ length: 8 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  const types = ['Residential', 'Commercial', 'Residential', 'Interior', 'Residential', 'Hospitality', 'Interior', 'Commercial'];
  return {
    slug: `project-${n}`,
    title: `Project ${n}`,
    type: types[i],
    image: img(`projects/project-${n}`),
    detail: img(`projects/project-${n}-detail`),
  };
});

export const heroSlides = projects.slice(0, 4);

export interface ProcessStep {
  title: string;
  body: string;
  image: string;
}

export const processSteps: ProcessStep[] = [
  {
    title: 'Brief & intention',
    body: 'We begin by listening. Your site, your routines, your budget and the story you want the building to tell - everything that follows is measured against this first conversation.',
    image: img('process/step-01'),
  },
  {
    title: 'Concept & direction',
    body: 'Intentions become architecture: massing, light, orientation and a material mood. We present one clear direction, drawn and modelled, rather than a catalogue of options.',
    image: img('process/step-02'),
  },
  {
    title: 'Space planning',
    body: 'Rooms are arranged around how you actually live and work - circulation, storage, privacy and daylight resolved before a single wall is priced.',
    image: img('process/step-03'),
  },
  {
    title: 'Walkthrough in 3D & VR',
    body: 'Before anything is built you walk through it. Our 3D workspace and VR reviews let you stand in each room, test finishes and lighting, and sign off with confidence.',
    image: img('process/step-04'),
  },
  {
    title: 'Materials & details',
    body: 'Finishes, joinery and fittings are chosen and detailed with the builders who will install them, so what you approved is exactly what gets made.',
    image: img('process/step-05'),
  },
  {
    title: 'Budget & approvals',
    body: 'Costs are aligned line by line and every permit and statutory approval is prepared and followed through, so construction starts on firm ground.',
    image: img('process/step-06'),
  },
  {
    title: 'Build & handover',
    body: 'Our site team manages construction, quality and schedule end to end - and hands over a finished building, documented and ready to live in.',
    image: img('process/step-07'),
  },
];

export interface Pathway {
  id: string;
  title: string;
  intro: string;
  items: string[];
}

export const pathways: Pathway[] = [
  {
    id: 'homeowners',
    title: 'Residential for homeowners',
    intro: 'A single team from the first sketch to the day you move in.',
    items: [
      'Site study and design brief',
      'Concept design and 3D walkthroughs',
      'Working drawings and approvals',
      'Material and finish selection',
      'Construction and site supervision',
      'Handover and documentation',
    ],
  },
  {
    id: 'developers',
    title: 'Residential for developers',
    intro: 'Plans that sell and buildings that deliver on them.',
    items: [
      'Feasibility and yield studies',
      'Unit mix and layout optimisation',
      'Marketing renders and VR show-units',
      'Cost planning and value engineering',
      'Construction management',
    ],
  },
  {
    id: 'commercial',
    title: 'Commercial & retail',
    intro: 'Spaces that carry a brand and work hard every day.',
    items: [
      'Brand and operations brief',
      'Concept and customer-journey design',
      'Fit-out drawings and specifications',
      'Contractor coordination',
      'Phased build and opening support',
    ],
  },
];

export const contactImage = img('contact/contact');
export const loginImage = img('login/login');
export const studioImage = img('home/studio');
export const processHeroImage = img('process/hero');
