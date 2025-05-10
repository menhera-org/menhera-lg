
export const getClassNameGetter = (componentName: string) => (className: string) => {
  return `c-${componentName}-${className}`;
};

export const classList = (...classes: string[]) => {
  return classes.filter(Boolean).join(' ');
};
