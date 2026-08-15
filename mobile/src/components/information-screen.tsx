import { PropsWithChildren } from "react";
import { Body, Eyebrow, H1, H2, Screen } from "./ui";
export function InformationScreen({ eyebrow, title, children }: PropsWithChildren<{ eyebrow: string; title: string }>) { return <Screen><Eyebrow>{eyebrow}</Eyebrow><H1>{title}</H1><Body muted>Last updated 12 August 2026</Body>{children}</Screen>; }
export function Section({ title, children }: PropsWithChildren<{ title: string }>) { return <><H2>{title}</H2><Body>{children}</Body></>; }
