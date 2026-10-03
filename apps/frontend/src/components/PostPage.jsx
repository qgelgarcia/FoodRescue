import React, { useState } from 'react';
import { IonButton, IonSelect, IonSelectOption } from '@ionic/react';
import { PlusCircle, Sparkles, CheckCircle2, ShieldCheck, HeartHandshake, Camera, X } from 'lucide-react';
import CustomerHeader from './CustomerHeader';
import PageShell from './PageShell';

import { DurationPicker } from './ui/calamansi/duration-picker';
import { createFoodPost } from '../services/food';
import { validateFoodPostDraft } from '../lib/validation';

export default function PostPage({ userProfile }) {
  const [foodName, setFoodName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Meals');
  const [quantity, setQuantity] = useState('5');
  const [pickupAddress, setPickupAddress] = useState('');
  const [photos, setPhotos] = useState([]);
  const [duration, setDuration] = useState({ hours: 3, minutes: 0 });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  function clearFieldError(field) {
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setFormError('');
  }

  const handlePhotoUpload = (e) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const invalidFile = selectedFiles.find((file) => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024);

      if (invalidFile) {
        setFieldErrors((previous) => ({
          ...previous,
          photos: 'Photos must be images smaller than 5 MB each.',
        }));
        return;
      }

      const filesArray = selectedFiles.map((file) => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...filesArray]);
      clearFieldError('photos');
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
    clearFieldError('photos');
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const validation = validateFoodPostDraft({
      foodName,
      description,
      category,
      quantity,
      pickupAddress,
      duration,
      photos,
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
      const result = await createFoodPost({
        foodName: validation.values.foodName,
        description: validation.values.description,
        category: validation.values.category,
        quantity: validation.values.quantity,
        pickupAddress: validation.values.pickupAddress,
        photoUrl: photos[0],
        expiresHours: totalHours > 0 ? totalHours : 3
      });

      if (result?.error) throw new Error(result.error);

      setSuccess(true);
      setFoodName('');
      setDescription('');
      setPickupAddress('');
      setPhotos([]);
      setQuantity('5');
      setDuration({ hours: 3, minutes: 0 });
      setFieldErrors({});
    } catch (error) {
      setFormError(error.message || 'The listing could not be published. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <div className="h-full w-full overflow-y-auto bg-[#f5faee] flex flex-col font-['DM_Sans',sans-serif] pb-28 relative">
      <CustomerHeader active="post" userProfile={userProfile} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#0c6b20] text-xs font-bold mb-2.5 border border-emerald-200">
            <PlusCircle size={13} />
            <span>CAMPUS FOOD DONOR HUB</span>
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
              <p className="font-bold text-xs">Food listing posted live! Students on campus can now view and claim it.</p>
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
          <form onSubmit={handleSubmit} className="md:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-[#2a382e]/15 shadow-sm space-y-5">
            
            <div>
              <label htmlFor="food-name" className="block text-xs font-bold text-[#182019] mb-1.5">
                Food Name / Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="food-name"
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
                Display Photos <span className="text-rose-500">*</span>
              </label>
              
              <div className="w-full bg-[#fbfdf8] border border-dashed border-[#2a382e]/30 rounded-2xl p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
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
                    <p className="text-xs text-[#687066] mt-1">Show what the food looks like</p>
                  </label>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {photos.map((src, idx) => (
                      <div key={idx} className="relative size-20 rounded-xl overflow-hidden shadow-sm border border-[#2a382e]/10 group">
                        <img src={src} alt="Upload preview" className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => removePhoto(idx)} 
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    
                    <label htmlFor="photo-upload" className="size-20 rounded-xl border border-dashed border-[#2a382e]/30 flex flex-col items-center justify-center text-[#687066] cursor-pointer hover:bg-emerald-50 hover:text-[#0c6b20] hover:border-emerald-200 shadow-sm transition-colors">
                      <PlusCircle size={20} />
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
                <IonSelect
                  required
                  id="food-category"
                  value={category}
                  onIonChange={(e) => { setCategory(e.detail.value); clearFieldError('category'); }}
                  aria-invalid={Boolean(fieldErrors.category)}
                  aria-label="Food category"
                  interface="popover"
                  className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl px-3 py-2.5 text-xs text-[#182019]"
                >
                  <IonSelectOption value="Meals">Meals (Prepared)</IonSelectOption>
                  <IonSelectOption value="Produce">Produce / Fresh Fruit</IonSelectOption>
                  <IonSelectOption value="Bakery">Bakery & Pastries</IonSelectOption>
                  <IonSelectOption value="Snacks">Packaged Snacks</IonSelectOption>
                </IonSelect>
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
                  aria-invalid={Boolean(fieldErrors.quantity)}
                  className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl px-4 py-2.5 text-xs text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
                />
                {fieldErrors.quantity && <p className="mt-1 text-xs text-rose-700">{fieldErrors.quantity}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="pickup-address" className="block text-xs font-bold text-[#182019] mb-1.5">
                Pickup Location & Instructions <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="pickup-address"
                required
                value={pickupAddress}
                onChange={(e) => { setPickupAddress(e.target.value); clearFieldError('pickupAddress'); }}
                aria-invalid={Boolean(fieldErrors.pickupAddress)}
                placeholder="e.g. Main Library Cafe, Ground Floor pickup counter"
                className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl px-4 py-2.5 text-xs text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
              />
              {fieldErrors.pickupAddress && <p className="mt-1 text-xs text-rose-700">{fieldErrors.pickupAddress}</p>}
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
                id="food-description"
                rows="3"
                value={description}
                onChange={(e) => { setDescription(e.target.value); clearFieldError('description'); }}
                aria-invalid={Boolean(fieldErrors.description)}
                placeholder="Describe items, ingredients, storage requirements, or any allergen notices..."
                className="w-full bg-[#fbfdf8] border border-[#2a382e]/20 rounded-2xl p-4 text-xs text-[#182019] focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
              ></textarea>
              {fieldErrors.description && <p className="mt-1 text-xs text-rose-700">{fieldErrors.description}</p>}
            </div>

            <IonButton
              type="submit"
              disabled={loading}
              expand="block"
              className="post-submit-ionic w-full mt-4 font-extrabold text-[15px] shadow-lg transition-all tracking-wide"
            >
              {loading ? 'Publishing Food Drop...' : 'Publish Food Drop Live'}
            </IonButton>

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

      </main>

      
      </div>
    </PageShell>
  );
}
