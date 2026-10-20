import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { architecturePhotoUrl, druPreviewPhotoUrl } from './api';

export default function DruPhoto({ bundleId, index, photo, onOpen }) {
  const root = useRef(null), [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true, objectUrl; const abort = new AbortController();
    setUrl(''); setFailed(false);
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      observer.disconnect();
      const fetchPhoto = photo?.id ? architecturePhotoUrl(photo.id) : druPreviewPhotoUrl(bundleId, index, abort.signal);
      fetchPhoto.then(value => { objectUrl = value; if (active) setUrl(value); else URL.revokeObjectURL(value); }).catch(e => { if (active && e.name !== 'AbortError') setFailed(true); });
    }, { rootMargin: '120px' });
    observer.observe(root.current);
    return () => { active = false; abort.abort(); observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [bundleId, index, photo?.id]);
  const content = <>{url ? <img src={url} alt={photo?.caption || photo?.kind || 'Field photograph'} /> : <span className="dru-photo-placeholder"><Camera size={22} /><small>{failed ? 'Preview unavailable' : 'Field photograph'}</small></span>}<span className="dru-photo-caption">{photo?.caption || photo?.kind || 'Field photograph'}</span></>;
  return onOpen ? <button ref={root} type="button" className="dru-photo" onClick={onOpen} aria-label={'Open ' + (photo?.caption || 'field photograph')}>{content}</button> : <div ref={root} className="dru-photo">{content}</div>;
}
