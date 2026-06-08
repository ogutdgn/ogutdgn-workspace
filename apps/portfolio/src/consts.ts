import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "Dogan Ogut",
  EMAIL: "contactdgn@ogutdgn.com",
};

export const TOOLS_URL = "https://tools.ogutdgn.com";

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Dogan Ogut — software developer",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "Writing about software and things I learn.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION: "A collection of my projects, with links to repositories and demos.",
};

export const SOCIALS: Socials = [
  { NAME: "github", HREF: "https://github.com/ogutdgn" },
  { NAME: "linkedin", HREF: "https://www.linkedin.com/in/doganogut/" },
  { NAME: "email", HREF: "mailto:contactdgn@ogutdgn.com" },
];
