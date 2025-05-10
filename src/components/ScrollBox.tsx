
import React, { useEffect, useRef } from "react";
import { ReactDOM } from "react";
import { classList, getClassNameGetter } from "../component-utils";

import "./ScrollBox.css";

export interface ScrollBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  scrollOrigin?: ScrollBoxScrollOrigin;
  scrollOffset?: number;
  outerClassName?: string;
  innerClassName?: string;
  onScrollOffsetChange?: (offset: number) => void;
}

export type ScrollBoxScrollOrigin = "start" | "end";

interface ScrollBoxState {
  clientHeight: number;
  scrollHeight: number;
  scrollOffset: number;
  scrollOrigin: ScrollBoxScrollOrigin;
}

export const CLASS = getClassNameGetter("ScrollBox");

export const ScrollBox: React.FC<ScrollBoxProps> = (props) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = React.useState<ScrollBoxState>({
    clientHeight: 0,
    scrollHeight: 0,
    scrollOffset: props.scrollOffset || 0,
    scrollOrigin: props.scrollOrigin || "start",
  });

  const setScrollBox = (scrollHeight: number, clientHeight: number) => {
    setState((prevState) => ({
      ...prevState,
      scrollHeight,
      clientHeight,
    }));
  };

  const setScrollOffset = (scrollOffset: number) => {
    setState((prevState) => ({
      ...prevState,
      scrollOffset,
    }));
  };

  let ignoreNextScrollEvent = false;

  const onScroll = (el: HTMLElement) => {
    if (ignoreNextScrollEvent) {
      ignoreNextScrollEvent = false;
      return;
    }
    const pos =
      props.scrollOrigin === "end"
        ? el.scrollHeight - el.scrollTop
        : el.scrollTop;
    props.onScrollOffsetChange?.(pos);
  };

  useEffect(() => {
    if (outerRef.current) {
      const currentScrollTop = outerRef.current.scrollTop;
      const targetScrollTop =
        props.scrollOrigin === "end"
          ? outerRef.current.scrollHeight - state.scrollOffset
          : state.scrollOffset;
      const scrollDiff = targetScrollTop - currentScrollTop;
      if (scrollDiff > 0) {
        ignoreNextScrollEvent = true;
        outerRef.current.scrollTop = targetScrollTop;
        console.log(
          `scrollTop: ${currentScrollTop} -> ${targetScrollTop} (${scrollDiff}), ${
            props.scrollOrigin || "start"
          } offset: ${state.scrollOffset}`
        );
      }
    }
  }, [state.scrollOffset, state.scrollHeight, state.clientHeight]);

  useEffect(() => {
    if (!outerRef.current || props.scrollOffset == null) {
      return;
    }

    setScrollOffset(props.scrollOffset);
  }, [props.scrollOrigin]);

  useEffect(() => {
    const onresize = () => {
      if (!outerRef.current) {
        return;
      }
      console.log(`onresize: scrollHeight = ${outerRef.current.scrollHeight}`);
      setScrollBox(
        outerRef.current.scrollHeight,
        outerRef.current.clientHeight
      );
    };

    const observer = new ResizeObserver(() => {
      onresize();
    });

    if (outerRef.current) {
      observer.observe(outerRef.current);
    }

    if (innerRef.current) {
      observer.observe(innerRef.current);
    }

    window.addEventListener("resize", onresize);
    onresize();

    return () => {
      window.removeEventListener("resize", onresize);
      if (outerRef.current) {
        observer.unobserve(outerRef.current);
      }
      if (innerRef.current) {
        observer.unobserve(innerRef.current);
      }
      observer.disconnect();
    };
  }, [outerRef, innerRef]);

  const ignoredProps = [
    "scrollOrigin",
    "scrollOffset",
    "outerClassName",
    "innerClassName",
    "onScrollOffsetChange",
    "onScroll",
    "children",
    "className",
  ];

  return (
    <div
      {...Object.fromEntries(Object.entries(props).filter(([key]) => !ignoredProps.includes(key)))}
      className={classList(
        CLASS("outer"),
        props.outerClassName || ""
      )}
      ref={outerRef}
      onScroll={(e) => onScroll(e.currentTarget)}
    >
      <div
        className={classList(
          CLASS("inner"),
          CLASS(
            props.scrollOrigin === "end" ? "origin-end" : "origin-start"
          ),
          props.innerClassName || ""
        )}
        ref={innerRef}
      >
        {props.children}
      </div>
    </div>
  );
};
