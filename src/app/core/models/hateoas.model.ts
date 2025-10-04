export interface Link {
  href: string;
  templated?: boolean;
}

export interface Hateoas {
  _links: {
    [key: string]: Link;
  };
}
