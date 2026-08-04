import debounce from 'lodash.debounce';
import { useMemo } from 'react';

export const useDebounce = <T extends (...args: Parameters<T>) => void>(
    func: T,
    wait: number = 500
): ((...args: Parameters<T>) => void) & { cancel: () => void } => {
    const debouncedFn = useMemo(() => {
        return debounce(func, wait);
    }, [func, wait]);
    return debouncedFn;
};

export default useDebounce;
