  import { friendlyError } from '../../services/request';
import React, { useEffect, useRef, useState } from 'react';
import { PlusCircle, Sparkles, CheckCircle2, ShieldCheck, HeartHandshake, Camera, X, Pencil, Archive } from 'lucide-react';
import CustomerHeader from '../../components/layout/CustomerHeader';
import PageShell from '../../components/layout/PageShell';

import { DurationPicker } from '../../components/ui/calamansi/duration-picker';
import { archiveFoodPost, createFoodPost, getOwnFoodPosts, removeFoodPhoto, updateFoodPost, uploadFoodPhoto } from '../../services/food';
import { validateFoodPostDraft } from '../../lib/validation';
import PickupLocationPicker from './PickupLocationPicker';

function postActionError(error) {
  const message = String(error?.message || '');
  if (/^(Choose|Enter|Add|Food name|Description|Category|Portions|Pickup|This listing|A cancellation|Explain the cancellation|Photo upload|Could not remove)/.test(message)) return message;
  return friendlyError(error);
}

export default function PostPage({ userProfile }) {
  const [foodName, setFoodName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Meals');
  const [quantity, setQuantity] = useState('5');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState(null);
  const [pickupLng, setPickupLng] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const photoPreview = useRef(null);
  const [duration, setDuration] = useState({ hours: 3, minutes: 0 });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [ownPosts, setOwnPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');
  const [archivingPostId, setArchivingPostId] = useState(null);
  const [cancellingPostId, setCancellingPostId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    loadOwnPosts();
  }, []);

  async function loadOwnPosts() {
    setPostsLoading(true);
    setPostsError('');
    try {
      setOwnPosts(await getOwnFoodPosts());
    } catch (error) {
      setPostsError(friendlyError(error));
    } finally {
      setPostsLoading(false);
    }
  }

  function resetDraft() {
    if (photoPreview.current) URL.revokeObjectURL(photoPreview.current);
    photoPreview.current = null;
    setEditingPostId(null);
    setFoodName('');
    setDescription('');
    setCategory('Meals');
    setQuantity('5');
    setPickupAddress('');
    setPickupLat(null);
    setPickupLng(null);
    setPhotos([]);
    setPhotoFile(null);
    setDuration({ hours: 3, minutes: 0 });
    setFieldErrors({});
    setFormError('');
    setSuccess(false);
  }

  function startEditing(post) {
    const remainingMinutes = Math.max(15, Math.min(24 * 60, Math.ceil((Date.parse(post.expires_at) - Date.now()) / 60000)));
    setEditingPostId(post.id);
    setFoodName(post.food_name);
    setDescription(post.description || '');
    setCategory(post.category || 'Meals');
    setQuantity(String(post.quantity_total));
    setPickupAddress(post.pickup_address);
    setPickupLat(post.pickup_lat ?? null);
    setPickupLng(post.pickup_lng ?? null);
    setPhotos(post.photo_url ? [post.photo_url] : []);
    setPhotoFile(null);
    setDuration({ hours: Math.floor(remainingMinutes / 60), minutes: remainingMinutes % 60 });
    setFieldErrors({});
    setFormError('');
    setSuccess(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearFieldError(field) {
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setFormError('');
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setFieldErrors(previous => ({ ...previous, photos: 'Choose one JPEG, PNG, or WebP image no larger than 5 MB.' }));
      return;
    }
    if (photoPreview.current) URL.revokeObjectURL(photoPreview.current);
    photoPreview.current = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotos([photoPreview.current]);
    clearFieldError('photos');
  };

  const removePhoto = () => {
    if (photoPreview.current) URL.revokeObjectURL(photoPreview.current);
    photoPreview.current = null;
    setPhotoFile(null);
    setPhotos([]);
    clearFieldError('photos');
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    const validation = validateFoodPostDraft({
      foodName,
      description,
      category,
      quantity,
      pickupAddress,
      pickupLat,
      pickupLng,
      duration,
    });

    setFieldErrors(validation.errors);
    if (!validation.isValid) {
      setFormError('Please fix the highlighted fields before publishing.');
      return;
    }
    
    setLoading(true);
    setSuccess(false);
    setFormError('');

    let uploadedPhotoPath = null;
    try {
      const totalHours = (validation.values.duration.hours || 0) + (validation.values.duration.minutes || 0) / 60;
      let photoUrl = photos[0];
      if (photoFile) {
        const uploaded = await uploadFoodPhoto(photoFile);
        uploadedPhotoPath = uploaded.path;
        photoUrl = uploaded.url;
      }
      const draft = {
        foodName: validation.values.foodName,
        description: validation.values.description,
        category: validation.values.category,
        quantity: validation.values.quantity,
        pickupAddress: validation.values.pickupAddress,
        pickupLat: validation.values.pickupLat,
        pickupLng: validation.values.pickupLng,
        photoUrl,
        expiresHours: totalHours > 0 ? totalHours : 3,
      };
      if (editingPostId) {
        const updated = await updateFoodPost(editingPostId, draft);
        setOwnPosts((previous) => previous.map((post) => post.id === updated.id ? updated : post));
        setSuccessMessage('Your listing has been updated.');
      } else {
        const result = await createFoodPost(draft);
        if (result?.error) throw new Error(result.error);
        setOwnPosts((previous) => [result.post, ...previous]);
        setSuccessMessage('Food listing posted live! Students on campus can now view and claim it.');
      }
      uploadedPhotoPath = null;
      resetDraft();
      setSuccess(true);
    } catch (error) {
      let cleanupError = '';
      if (uploadedPhotoPath) {
        try { await removeFoodPhoto(uploadedPhotoPath); }
        catch { cleanupError = ' The uploaded image could not be removed; contact support if it remains in your uploads.'; }
      }
      setFormError(`${postActionError(error)}${cleanupError}`);
    } finally {
      setLoading(false);
    }
  }

  function handleArchive(post) {
    setCancellingPostId(post.id);
    setCancellationReason('');
  }

  async function submitCancellation(post) {
    setArchivingPostId(post.id);
    setPostsError('');
    try {
      await archiveFoodPost(post.id, cancellationReason);
      setOwnPosts(previous => previous.map(item => item.id === post.id
        ? { ...item, status: 'removed_by_donor', donor_cancel_reason: cancellationReason.trim() }
        : item));
      if (editingPostId === post.id) resetDraft();
      setCancellingPostId(null);
    } catch (error) {
      setPostsError(postActionError(error));
    } finally {
      setArchivingPostId(null);
    }
  }

  const editingPost = ownPosts.find(post => post.id === editingPostId);
  const editLocked = Boolean(editingPost && Number(editingPost.quantity_remaining) < Number(editingPost.quantity_total));

  return (
    <PageShell>
      <div className="h-full w-full overflow-y-auto flex flex-col font-['DM_Sans',sans-serif] pb-28 relative">
      <CustomerHeader active="post" userProfile={userProfile} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">

        {userProfile?.status !== 'active' && <p role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your account cannot publish new listings while it is suspended. You can still report concerns and finish existing pickups.
        </p>}
        
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#0c6b20] text-xs font-bold mb-2.5 border border-emerald-200">
            <PlusCircle size={13} />
            <span>{editingPostId ? 'EDIT FOOD LISTING' : 'CAMPUS FOOD DONOR HUB'}</span>
          </div>
          <h1 className="font-['Space_Grotesk'] text-3xl font-extrabold text-[#182019]">
            Share Surplus Food
          </h1>
          <p className="text-xs text-[#4c5b4f] mt-1">
            Dining halls, event caterers, and campus groups: list extra portions before they expire.
          </p>
        </div>

        {formError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 shadow-sm" role="alert">
            <p className="font-bold text-xs">{formError}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-600 text-white shadow-md flex items-center justify-between" role="status">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎉</span>
              <p className="font-bold text-xs">{successMessage}</p>
            </div>
            <button 
              onClick={() => setSuccess(false)}
              className="text-xs bg-white/20 px-3 py-1 rounded-lg text-white font-semibold"
            >
              OK
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Form */}
          <form noValidate onBlurCapture={(event) => {
            const key = { 'food-name': 'foodName', 'food-description': 'description', 'food-quantity': 'quantity', 'pickup-address': 'pickupAddress', 'food-category': 'category', 'photo-upload': 'photos' }[event.target.id];
            if (!key) return;
            const errors = validateFoodPostDraft({ foodName, description, category, quantity, pickupAddress, pickupLat, pickupLng, duration }).errors;
            setFieldErrors(previous => ({ ...previous, [key]: errors[key] }));
          }} aria-busy={loading} onSubmit={handleSubmit} className="md:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-[#2a382e]/15 shadow-sm space-y-5">
            
            <div>
              <label htmlFor="food-name" className="block text-xs font-bold text-[#182019] mb-1.5">
                Food Name / Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="food-name" maxLength={120}
                required
                value={foodName}
                onChange={(e) => { setFoodName(e.target.value); clearFieldError('foodName'); }}
                aria-invalid={Boolean(fieldErrors.foodName)}
                aria-describedby={fieldErrors.foodName ? 'food-name-error' : undefined}
                placeholder="e.g. Assorted Artisan Sandwiches (10 boxes)"
                className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl px-4 py-2.5 text-xs text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
              />
              {fieldErrors.foodName && <p id="food-name-error" className="mt-1 text-xs text-rose-700">{fieldErrors.foodName}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#182019] mb-1.5">
                Display Photo <span className="text-[#687066]">(optional)</span>
              </label>
              
              <div className="w-full bg-[#fbfdf8] border border-dashed border-[#2a382e]/30 rounded-2xl p-4 text-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  id="photo-upload"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                
                {photos.length === 0 ? (
                  <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center justify-center py-4 hover:opacity-80 transition-opacity">
                    <div className="size-12 rounded-full bg-emerald-50 text-[#0c6b20] flex items-center justify-center mb-2 shadow-sm">
                      <Camera size={20} />
                    </div>
                    <p className="text-sm font-bold text-[#182019]">Take a photo or upload</p>
                    <p className="text-xs text-[#687066] mt-1">JPEG, PNG, or WebP · up to 5 MB</p>
                  </label>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {photos.map((src, idx) => (
                      <div key={idx} className="relative size-20 rounded-xl overflow-hidden shadow-sm border border-[#2a382e]/10 group">
                        <img src={src} alt="Upload preview" className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            aria-label="Remove display photo"
                            onClick={removePhoto}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                      </div>
                    ))}
                    
                    <label htmlFor="photo-upload" className="size-20 rounded-xl border border-dashed border-[#2a382e]/30 flex flex-col items-center justify-center text-[#687066] cursor-pointer hover:bg-emerald-50 hover:text-[#0c6b20] hover:border-emerald-200 shadow-sm transition-colors">
                      <Pencil size={18} /><span className="text-[10px]">Replace</span>
                    </label>
                  </div>
                )}
              </div>
              {fieldErrors.photos && <p className="mt-1 text-xs text-rose-700" role="alert">{fieldErrors.photos}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="food-category" className="block text-xs font-bold text-[#182019] mb-1.5">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  id="food-category"
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); clearFieldError('category'); }}
                  aria-invalid={Boolean(fieldErrors.category)}
                  aria-label="Food category"
                  className="food-category-select"
                >
                  <option value="Meals">Meals (Prepared)</option>
                  <option value="Produce">Produce / Fresh Fruit</option>
                  <option value="Bakery">Bakery & Pastries</option>
                  <option value="Snacks">Packaged Snacks</option>
                </select>
                {fieldErrors.category && <p className="mt-1 text-xs text-rose-700">{fieldErrors.category}</p>}
              </div>

              <div>
                <label htmlFor="food-quantity" className="block text-xs font-bold text-[#182019] mb-1.5">
                  Portions Available <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  id="food-quantity"
                  required
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => { setQuantity(e.target.value); clearFieldError('quantity'); }}
                  readOnly={editLocked}
                  aria-describedby={editLocked ? 'food-quantity-help' : undefined}
                  aria-invalid={Boolean(fieldErrors.quantity)}
                  className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl px-4 py-2.5 text-xs text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
                />
                {editLocked && <p id="food-quantity-help" className="mt-1 text-[11px] text-[#687066]">Quantity is locked after the first claim.</p>}
                {fieldErrors.quantity && <p className="mt-1 text-xs text-rose-700">{fieldErrors.quantity}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="pickup-address" className="block text-xs font-bold text-[#182019] mb-1.5">
                Pickup Location & Instructions <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="pickup-address" maxLength={240}
                required
                value={pickupAddress}
                onChange={(e) => { setPickupAddress(e.target.value); clearFieldError('pickupAddress'); }}
                aria-invalid={Boolean(fieldErrors.pickupAddress)}
                placeholder="e.g. Main Library Cafe, Ground Floor pickup counter"
                className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl px-4 py-2.5 text-xs text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
              />
              {fieldErrors.pickupAddress && <p className="mt-1 text-xs text-rose-700">{fieldErrors.pickupAddress}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#182019]">Pickup Pin <span className="text-rose-500">*</span></label>
              <PickupLocationPicker
                latitude={pickupLat}
                longitude={pickupLng}
                onChange={(lat, lng) => { setPickupLat(lat); setPickupLng(lng); clearFieldError('pickupLocation'); }}
              />
              {fieldErrors.pickupLocation && <p className="mt-1 text-xs text-rose-700" role="alert">{fieldErrors.pickupLocation}</p>}
            </div>

            {/* Liquid Duration Picker with Metaball Split */}
            <div className="bg-[#fbfdf8] p-4 rounded-2xl border border-[#2a382e]/15">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-xs font-bold text-[#182019]">
                    Pickup Window Duration (Expiry Timer) <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-[#687066]">
                    Press the pen icon to edit hours and minutes with liquid metaballs.
                  </p>
                </div>
              </div>

              <div className="pt-3 pb-2 px-2 flex flex-col sm:flex-row sm:items-center gap-4">
                <DurationPicker
                  value={duration}
                  onChange={(value) => { setDuration(value); clearFieldError('duration'); }}
                  onConfirm={(value) => { setDuration(value); clearFieldError('duration'); }}
                  variant="calamansi"
                  size="lg"
                />
                <span className="text-sm text-[#687066] font-medium">
                  → Expires in <b className="text-[#182019]">{duration.hours}h {duration.minutes}m</b>
                </span>
              </div>
              {fieldErrors.duration && <p className="mt-1 px-2 text-xs text-rose-700">{fieldErrors.duration}</p>}
            </div>

            <div>
              <label htmlFor="food-description" className="block text-xs font-bold text-[#182019] mb-1.5">
                Description & Dietary Notes <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                id="food-description" maxLength={1000}
                rows="3"
                value={description}
                onChange={(e) => { setDescription(e.target.value); clearFieldError('description'); }}
                aria-invalid={Boolean(fieldErrors.description)}
                placeholder="Describe items, ingredients, storage requirements, or any allergen notices..."
                className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl p-4 text-xs text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
              ></textarea>
              {fieldErrors.description && <p className="mt-1 text-xs text-rose-700">{fieldErrors.description}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || userProfile?.status !== 'active' || !validateFoodPostDraft({ foodName, description, category, quantity, pickupAddress, pickupLat, pickupLng, duration }).isValid}
              className="bg-gradient-to-b from-[#2c8a38] to-[#1c6428] text-white rounded-2xl py-4 px-6 w-full mt-4 font-extrabold text-[15px] shadow-lg transition-all tracking-wide"
            >
              {loading ? (editingPostId ? 'Saving Changes...' : 'Publishing Food Drop...') : (editingPostId ? 'Save Listing Changes' : 'Publish Food Drop Live')}
            </button>
            {editingPostId && (
              <button
                type="button"
                onClick={resetDraft}
                className="w-full rounded-2xl border border-[#2a382e]/20 py-3 text-sm font-bold text-[#4c5b4f]"
              >
                Cancel Editing
              </button>
            )}

          </form>

          {/* Posting Tips Rail */}
          <aside className="space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-[#2a382e]/10 shadow-sm text-[#182019]">
              <h4 className="font-bold text-sm flex items-center gap-2 mb-3 text-[#0c6b20]">
                <ShieldCheck size={18} />
                <span>Safe Sharing Guidelines</span>
              </h4>
              <ul className="text-xs space-y-2 text-[#4c5b4f] leading-relaxed">
                <li>• <b>Temperature:</b> Keep hot food above 140°F and cold food chilled.</li>
                <li>• <b>Packaging:</b> Use sealed or covered containers for sanitary pickup.</li>
                <li>• <b>Allergens:</b> Clearly specify nuts, dairy, or gluten when known.</li>
                <li>• <b>Pickup Window:</b> Set a realistic window so students can arrive on time.</li>
              </ul>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-[#2a382e]/10 shadow-sm text-center">
              <div className="size-10 rounded-2xl bg-emerald-50 text-[#0c6b20] border border-emerald-200 flex items-center justify-center mx-auto mb-2">
                <HeartHandshake size={20} />
              </div>
              <p className="font-bold text-xs text-[#182019]">Thank you for rescuing food!</p>
              <p className="text-[11px] text-[#687066] mt-1">Every meal diverted prevents approximately 0.5 kg of greenhouse emissions.</p>
            </div>
          </aside>

        </div>

        <section className="mt-10" aria-labelledby="your-listings-heading">
          <h2 id="your-listings-heading" className="mb-4 font-['Space_Grotesk'] text-2xl font-extrabold text-[#182019]">My Posts</h2>
          {postsError && <p className="mb-4 text-sm text-rose-700" role="alert">{postsError}</p>}
          {postsLoading ? (
            <p className="text-sm text-[#687066]">Loading your listings...</p>
          ) : ownPosts.length === 0 ? (
            <p className="rounded-2xl border border-[#2a382e]/10 bg-white p-5 text-sm text-[#687066]">You have no posts yet.</p>
          ) : (
            <ul className="space-y-3">
              {ownPosts.map((post) => (
                <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2a382e]/10 bg-white p-4">
                  <div>
                    <h3 className="font-bold text-[#182019]">{post.food_name}</h3>
                    <p className="text-xs text-[#687066]">{Math.max(0, Number(post.quantity_remaining) || 0)} of {post.quantity_total} portions available · {post.pickup_address}</p>
                    <p className="mt-1 text-xs font-semibold text-[#4c5b4f]">Status: {Date.parse(post.expires_at) <= Date.now() && post.status === 'active' ? 'Expired' : (post.status || 'unknown').replaceAll('_', ' ')}</p>
                    {post.donor_cancel_reason && <p className="mt-1 text-xs text-[#687066]">Cancellation: {post.donor_cancel_reason}</p>}
                    {Number(post.quantity_remaining) < Number(post.quantity_total) && <p className="mt-1 text-xs text-amber-800">Editing locked after first claim.</p>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={post.status !== 'active' || Date.parse(post.expires_at) <= Date.now() || Number(post.quantity_remaining) < Number(post.quantity_total)} onClick={() => startEditing(post)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#2a382e]/15 px-3 text-xs font-bold text-[#182019] disabled:opacity-40">
                      <Pencil size={13} /> Edit
                    </button>
                    <button type="button" disabled={post.status !== 'active' || archivingPostId === post.id} onClick={() => handleArchive(post)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-xs font-bold text-rose-700 disabled:opacity-50">
                      <Archive size={13} /> {archivingPostId === post.id ? 'Cancelling...' : 'Cancel post'}
                    </button>
                  </div>
                  {cancellingPostId === post.id && <form className="w-full space-y-2" onSubmit={event => { event.preventDefault(); submitCancellation(post); }}>
                    <label className="block text-xs font-semibold text-[#182019]" htmlFor={`cancel-reason-${post.id}`}>Why are you cancelling this post? (5 to 500 characters)</label>
                    <textarea id={`cancel-reason-${post.id}`} required minLength={5} maxLength={500} value={cancellationReason} onChange={event => setCancellationReason(event.target.value)} className="w-full rounded-xl border border-[#2a382e]/20 p-3 text-sm" />
                    <div className="flex gap-2">
                      <button type="submit" disabled={Boolean(archivingPostId)} className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white">Confirm cancellation</button>
                      <button type="button" onClick={() => setCancellingPostId(null)} className="rounded-xl border px-4 py-2 text-xs font-bold">Keep post</button>
                    </div>
                  </form>}
                </li>
              ))}
            </ul>
          )}
        </section>

      </main>

      
      </div>
    </PageShell>
  );
}
