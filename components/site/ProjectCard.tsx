import React from 'react';
import { LabelCard, SiteImage } from './brand';
import type { Project } from './content';

export function ProjectCard({ project, clip = true }: { project: Project; clip?: boolean }) {
  return (
    <article className="nv-card" data-flip-id={project.slug}>
      <div className="nv-media nv-card__media" {...(clip ? { 'data-nv-clip': '' } : {})}>
        <SiteImage src={project.image} alt={`${project.title} - ${project.type}`} />
      </div>
      <LabelCard title={project.title} sub={project.type} className="nv-card__tag" />
      <div className="nv-card__meta">
        <span className="nv-eyebrow">{project.title}</span>
        <span className="nv-eyebrow">{project.type}</span>
      </div>
    </article>
  );
}
