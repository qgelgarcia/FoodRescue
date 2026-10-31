import LoadingState from '../../components/feedback/LoadingState';
import { friendlyError } from '../../services/request';
import React, { useEffect, useState } from 'react';
import { ShieldCheck, Camera, X, Pencil, XCircle, RefreshCw } from 'lucide-react';
import PageShell from '../../components/layout/PageShell';
import './PostPage.css';
import PickupPinPicker from '../../components/post/PickupPinPicker';

import { DurationPicker } from '../../components/ui/calamansi/duration-picker';
import { cancelFoodPost, createFoodPost, getOwnFoodPosts, updateFoodPost } from '../../services/food';
import { FoodPhotoError, validateFoodPhotoFile } from '../../lib/food-photo';
import { validateFoodPostDraft } from '../../lib/validation';
import { useSharedRefresh } from '../../lib/shared-refresh';

function postStatusLabel(status) {
  return ({
    active: 'Available',
    fully_claimed: 'Fully reserved',
    expired: 'Expired',
    removed_by_donor: 'Cancelled by donor',
    removed_by_admin: 'Removed by admin',
  })[status] || status;
}

export default function PostPage({ userProfile }) {
  const [foodName, setFoodName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Meals');
  const [quantity, setQuantity] = useState('5');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPin, setPickupPin] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
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
  const [cancelReasonPostId, setCancelReasonPostId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingPostId, setCancellingPostId] = useState(null);

  useEffect(() => {
    loadOwnPosts({ showLoading: true });
  }, []);

  useSharedRefresh(() => loadOwnPosts());

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(existingPhotoUrl);
      return undefined;
    }
    const preview = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photoFile, existingPhotoUrl]);

  async function loadOwnPosts({ showLoading = false } = {}) {
    if (showLoading) setPostsLoading(true);
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
    setEditingPostId(null);
    setFoodName('');
    setDescription('');
    setCategory('Meals');
    setQuantity('5');
    setPickupAddress('');
    setPickupPin(null);
    setPhotoFile(null);
    setExistingPhotoUrl('');
    setOriginalPhotoUrl('');
    setDuration({ hours: 3, minutes: 0 });
    setFieldErrors({});
    setFormError('');
    setSuccess(false);
  }

  function startEditing(post) {
    if (post.status !== 'active' || post.has_claim_history) return;
    const remainingMinutes = Math.max(15, Math.min(24 * 60, Math.ceil((Date.parse(post.expires_at) - Date.now()) / 60000)));
    setEditingPostId(post.id);
    setFoodName(post.food_name);
    setDescription(post.description || '');
    setCategory(post.category || 'Meals');
    setQuantity(String(post.quantity_total));
    setPickupAddress(post.pickup_address);
    setPickupPin(Number.isFinite(Number(post.pickup_lat)) && Number.isFinite(Number(post.pickup_lng))
      ? { lat: Number(post.pickup_lat), lng: Number(post.pickup_lng) }
      : null);
    setPhotoFile(null);
    setExistingPhotoUrl(post.photo_url || '');
    setOriginalPhotoUrl(post.photo_url || '');
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
    const selectedFile = e.target.files?.[0];
    e.target.value = '';
    if (!selectedFile) return;
    const error = validateFoodPhotoFile(selectedFile);
    if (error) {
      setFieldErrors((previous) => ({ ...previous, photos: error }));
      return;
    }
    setPhotoFile(selectedFile);
    setExistingPhotoUrl('');
    clearFieldError('photos');
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setExistingPhotoUrl('');
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
      duration,
      pickupPin,
      photoFile,
    });

    setFieldErrors(validation.errors);
    if (!validation.isValid) {
      setFormError('Please fix the highlighted fields before publishing.');
      return;
    }
    
    setLoading(true);
    setSuccess(false);
    setFormError('');

    try {
      const totalHours = (validation.values.duration.hours || 0) + (validation.values.duration.minutes || 0) / 60;
      const draft = {
        foodName: validation.values.foodName,
        description: validation.values.description,
        category: validation.values.category,
        quantity: validation.values.quantity,
        pickupAddress: validation.values.pickupAddress,
        pickupPin: validation.values.pickupPin,
        photoUrl: existingPhotoUrl,
        previousPhotoUrl: originalPhotoUrl,
        photoFile,
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
      resetDraft();
      setSuccess(true);
    } catch (error) {
      setFormError(error instanceof FoodPhotoError ? error.message : friendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelPost(post) {
    const reason = cancelReason.trim();
    if (reason.length < 10 || reason.length > 2000) return;
    setCancellingPostId(post.id);
    setPostsError('');
    try {
      await cancelFoodPost(post.id, reason);
      await loadOwnPosts();
      setCancelReasonPostId(null);
      setCancelReason('');
      if (editingPostId === post.id) resetDraft();
    } catch (error) {
      setPostsError(friendlyError(error));
    } finally {
      setCancellingPostId(null);
    }
  }

  return (
    <PageShell>
      <div className="donor-post-page h-full w-full overflow-y-auto flex flex-col font-['DM_Sans',sans-serif] pb-28 relative">

      <main className="post-content flex-1 w-full mx-auto">

        {userProfile?.status !== 'active' && <p role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your account cannot publish new listings while it is suspended. You can still report concerns and finish existing pickups.
        </p>}
        
        <div className="post-heading">
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

        <div className="post-workspace">
          
          {/* Main Form */}
          <form noValidate onBlurCapture={(event) => {
            const key = { 'food-name': 'foodName', 'food-description': 'description', 'food-quantity': 'quantity', 'pickup-address': 'pickupAddress', 'food-category': 'category', 'photo-upload': 'photos' }[event.target.id];
            if (!key) return;
            const errors = validateFoodPostDraft({ foodName, description, category, quantity, pickupAddress, duration, pickupPin, photoFile }).errors;
            setFieldErrors(previous => ({ ...previous, [key]: errors[key] }));
          }} aria-busy={loading} onSubmit={handleSubmit} className="donor-post-form">
            
            <div className="post-field post-title">
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

            <div className="post-field post-photo">
              <label htmlFor="photo-upload" className="block text-xs font-bold text-[#182019] mb-1.5">
                Display Photo <span className="font-medium text-[#687066]">(optional)</span>
              </label>
              
              <div className="w-full bg-[#fbfdf8] border border-dashed border-[#2a382e]/30 rounded-2xl p-4 text-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  capture="environment"
                  id="photo-upload"
                  className="hidden"
                  disabled={loading}
                  onChange={handlePhotoUpload}
                />
                
                {!photoPreviewUrl ? (
                  <label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center justify-center py-4 hover:opacity-80 transition-opacity">
                    <div className="size-12 rounded-full bg-emerald-50 text-[#0c6b20] flex items-center justify-center mb-2 shadow-sm">
                      <Camera size={20} />
                    </div>
                    <p className="text-sm font-bold text-[#182019]">Add one food photo</p>
                    <p className="text-xs text-[#687066] mt-1">JPEG, PNG, or WebP · up to 5 MB</p>
                  </label>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <img src={photoPreviewUrl} alt="Food listing preview" className="size-24 rounded-xl border border-[#2a382e]/10 object-cover" />
                    <div className="flex flex-col items-start gap-2">
                      <label htmlFor="photo-upload" className="cursor-pointer text-xs font-bold text-[#0c6b20]">Replace photo</label>
                      <button type="button" onClick={removePhoto} className="text-xs font-semibold text-rose-700">Remove photo</button>
                    </div>
                  </div>
                )}
              </div>
              {photoFile && loading && <p className="mt-1 text-xs text-[#0c6b20]" role="status">Uploading photo and saving your listing…</p>}
              {!photoPreviewUrl && <p className="mt-1 text-[11px] text-[#687066]">Listings without a photo use the default image.</p>}
              {fieldErrors.photos && <p className="mt-1 text-xs text-rose-700" role="alert">{fieldErrors.photos}</p>}
            </div>

            <div className="post-category grid grid-cols-2 gap-4">
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
                  readOnly={Boolean(editingPostId)}
                  aria-describedby={editingPostId ? 'food-quantity-help' : undefined}
                  aria-invalid={Boolean(fieldErrors.quantity)}
                  className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl px-4 py-2.5 text-xs text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
                />
                {editingPostId && <p id="food-quantity-help" className="mt-1 text-[11px] text-[#687066]">Quantity is locked while editing to protect existing claims.</p>}
                {fieldErrors.quantity && <p className="mt-1 text-xs text-rose-700">{fieldErrors.quantity}</p>}
              </div>
            </div>

            <div className="post-field post-address">
              <label htmlFor="pickup-address" className="block text-xs font-bold text-[#182019] mb-1.5">
                Pickup Location & Instructions <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="pickup-address" maxLength={240}
                required
                rows="2"
                value={pickupAddress}
                onChange={(e) => { setPickupAddress(e.target.value); clearFieldError('pickupAddress'); }}
                aria-invalid={Boolean(fieldErrors.pickupAddress)}
                placeholder="Include the building, entrance, pickup instructions, and handoff details."
                className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl p-4 text-xs text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
              ></textarea>
              {fieldErrors.pickupAddress && <p className="mt-1 text-xs text-rose-700">{fieldErrors.pickupAddress}</p>}
            </div>

            <div className="post-pin">
              <h2 className="mb-1.5 text-xs font-bold text-[#182019]">Pickup Pin <span className="text-rose-500">*</span></h2>
              <PickupPinPicker value={pickupPin} onChange={(pin) => { setPickupPin(pin); clearFieldError('pickupPin'); }} />
              {fieldErrors.pickupPin && <p className="mt-1 text-xs text-rose-700" role="alert">{fieldErrors.pickupPin}</p>}
            </div>

            {/* Liquid Duration Picker with Metaball Split */}
            <div className="post-duration">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-xs font-bold text-[#182019]">
                    Pickup window <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-[#687066]">
                    Choose how long your listing stays available.
                  </p>
                </div>
              </div>

              <div className="pt-3 pb-2 px-2 flex flex-col sm:flex-row sm:items-center gap-4">
                <DurationPicker
                  value={duration}
                  onChange={(value) => { setDuration(value); clearFieldError('duration'); }}
                  onConfirm={(value) => { setDuration(value); clearFieldError('duration'); }}
                  variant="calamansi"
                  size="sm"
                />
                <span className="text-sm text-[#687066] font-medium">
                  → Expires in <b className="text-[#182019]">{duration.hours}h {duration.minutes}m</b>
                </span>
              </div>
              {fieldErrors.duration && <p className="mt-1 px-2 text-xs text-rose-700">{fieldErrors.duration}</p>}
            </div>

            <div className="post-field post-description">
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
              disabled={loading || userProfile?.status !== 'active' || !validateFoodPostDraft({ foodName, description, category, quantity, pickupAddress, duration, pickupPin, photoFile }).isValid}
              className="post-submit bg-gradient-to-b from-[#2c8a38] to-[#1c6428] text-white rounded-2xl py-4 px-6 w-full mt-4 font-extrabold text-[15px] shadow-lg transition-all tracking-wide"
            >
              {loading ? (photoFile ? 'Uploading Photo...' : editingPostId ? 'Saving Changes...' : 'Publishing Food Drop...') : (editingPostId ? 'Save Listing Changes' : 'Publish Food Drop Live')}
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

          <details className="post-guidelines">
            <summary><ShieldCheck size={17} /> Safe sharing guidelines</summary>
            <ul>
              <li><b>Temperature:</b> Keep hot food above 140�F and cold food chilled.</li>
              <li><b>Packaging:</b> Use sealed or covered containers for sanitary pickup.</li>
              <li><b>Allergens:</b> Specify known nuts, dairy, or gluten.</li>
              <li><b>Pickup:</b> Allow enough time for people to arrive.</li>
            </ul>
          </details>

        </div>

        <section className="post-listings" aria-labelledby="your-listings-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="your-listings-heading" className="font-['Space_Grotesk'] text-2xl font-extrabold text-[#182019]">Your Listings</h2>
              <p className="mt-1 text-xs text-[#687066]">Current listings and closed listing history appear here.</p>
            </div>
            <button type="button" onClick={() => loadOwnPosts({ showLoading: true })} disabled={postsLoading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#2a382e]/15 bg-white px-3 text-xs font-bold text-[#182019] disabled:opacity-50">
              <RefreshCw size={14} className={postsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {postsError && <LoadingState error={postsError} onRetry={() => loadOwnPosts({ showLoading: true })} />}
          {postsLoading ? (
            <LoadingState label="Loading your listings" onRetry={() => loadOwnPosts({ showLoading: true })} />
          ) : ownPosts.length === 0 ? (
            <p className="rounded-2xl border border-[#2a382e]/10 bg-white p-5 text-sm text-[#687066]">You have no listings yet. Posts you create will appear here with their status and history.</p>
          ) : (
            <ul className="space-y-3">
              {ownPosts.map((post) => (
                <li key={post.id} className="rounded-2xl border border-[#2a382e]/10 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-[#182019]">{post.food_name}</h3>
                        <span className="rounded-full bg-[#f1f5ee] px-2.5 py-1 text-[11px] font-bold text-[#435448]">{postStatusLabel(post.status)}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#687066]">
                        {post.quantity_remaining ?? 0} of {post.quantity_total} portions available · {post.pickup_address}
                      </p>
                      <p className="mt-1 text-[11px] text-[#687066]">Pickup window ends {post.expires_at ? new Date(post.expires_at).toLocaleString() : '—'}</p>
                      {post.cancellation_reason && <p className="mt-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-900"><b>Donor cancellation explanation:</b> {post.cancellation_reason}</p>}
                    </div>
                    <div className="flex gap-2">
                      {post.status === 'active' && !post.has_claim_history && <button type="button" onClick={() => startEditing(post)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#2a382e]/15 px-3 text-xs font-bold text-[#182019]">
                        <Pencil size={13} /> Edit
                      </button>}
                      {['active', 'fully_claimed'].includes(post.status) && <button type="button" onClick={() => { setCancelReasonPostId(cancelReasonPostId === post.id ? null : post.id); setCancelReason(''); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-xs font-bold text-rose-700">
                        <XCircle size={14} /> Cancel listing
                      </button>}
                    </div>
                  </div>
                  {cancelReasonPostId === post.id && <form onSubmit={(event) => { event.preventDefault(); handleCancelPost(post); }} className="mt-4 border-t border-[#2a382e]/10 pt-4">
                    <label htmlFor={'cancel-post-' + post.id} className="mb-1.5 block text-xs font-bold text-[#182019]">Explain why you are cancelling this listing</label>
                    <textarea id={'cancel-post-' + post.id} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} minLength={10} maxLength={2000} rows={3} required placeholder="This explanation will be shown to people with affected claims." className="w-full rounded-xl border border-[#2a382e]/20 bg-[#fbfdf8] p-3 text-sm text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]" />
                    <p className="mt-1 text-[11px] text-[#687066]">Enter 10 to 2,000 characters. Affected claimants will see this explanation.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="submit" disabled={cancellingPostId === post.id || cancelReason.trim().length < 10 || cancelReason.trim().length > 2000} className="inline-flex min-h-10 items-center rounded-xl bg-rose-700 px-4 text-xs font-bold text-white disabled:opacity-50">
                        {cancellingPostId === post.id ? 'Cancelling listing…' : 'Confirm cancellation'}
                      </button>
                      <button type="button" disabled={cancellingPostId === post.id} onClick={() => { setCancelReasonPostId(null); setCancelReason(''); }} className="inline-flex min-h-10 items-center rounded-xl border border-[#2a382e]/15 px-4 text-xs font-bold text-[#354438] disabled:opacity-50">Keep listing</button>
                    </div>
                  </form>}
                </li>
              ))}
            </ul>
          )}
          <a href="/app/history" className="mt-4 inline-flex text-xs font-bold text-[#0c6b20] hover:underline">View donor requests and pickup status</a>
        </section>

      </main>

      
      </div>
    </PageShell>
  );
}
