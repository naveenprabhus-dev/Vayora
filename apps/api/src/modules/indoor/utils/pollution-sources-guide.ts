import type { IndoorPollutionSourceGuide } from '@uaqa/contracts';

export function getCommonIndoorPollutionSources(): readonly IndoorPollutionSourceGuide[] {
  return [
    {
      id: 'cooking_emissions',
      title: 'Cooking emissions (particulates, grease aerosols & combustion gases)',
      whatItIs:
        'Fine particles, steam-carried grease droplets, ultrafine aerosols, and—when using gas or solid-fuel stoves—nitrogen dioxide (NO2) and carbon monoxide (CO) released during frying, broiling, baking, or simmering.',
      howItAffectsIndoorAir:
        'High-heat searing and pan-frying can elevate indoor fine particle levels rapidly, while unvented gas burners add combustion gases directly into kitchen and adjacent living spaces.',
      practicalReductionSteps: [
        'Use back burners when practical and turn on a vented kitchen exhaust fan before starting high-heat cooking, if your kitchen has one.',
        'Place lids on pots and pans to trap steam and splatters, and simmer or boil when recipes allow rather than charring oils past their smoke point.',
        'If no vented range hood is available, crack a kitchen window briefly while cooking (balancing outdoor pollution conditions) to let heat and steam escape.',
      ],
      relevantPrecautions: [
        'Never use a gas oven or stovetop to heat your home.',
        'Ensure recirculating charcoal hoods are not mistaken for outdoor-venting exhausts—they do not remove combustion gases like CO or NO2.',
      ],
      limitations:
        'Guidance is general and qualitative; actual indoor buildup depends on kitchen volume, burner fuel, and exhaust airflow.',
      informationCategory: 'general_educational_guidance',
      sourceReference:
        'General public-health indoor air hygiene principles aligned with US EPA Indoor Air Quality & WHO Household Energy guidance (general educational reference; not a household inspection).',
    },
    {
      id: 'tobacco_or_combustion_smoke',
      title: 'Smoke from tobacco, e-cigarettes, or indoor combustion',
      whatItIs:
        'Secondhand and thirdhand tobacco smoke, vaping aerosols, or smoke escaping from fireplaces, wood stoves, or outdoor firepits near doorways.',
      howItAffectsIndoorAir:
        'Combustion smoke releases dense mixtures of fine particulate matter (PM2.5), carbon monoxide, and irritating organic compounds that linger indoors and settle onto fabrics and surfaces.',
      practicalReductionSteps: [
        'Maintain a smoke-free indoor home and avoid smoking directly outside open windows, vents, or entryway doors.',
        'Wash smoke-exposed textiles and clean hard surfaces with damp cloths rather than masking smoke odors with sprays.',
      ],
      relevantPrecautions: [
        'Opening a single window or running a portable air purifier cannot fully protect other rooms once smoke is released indoors.',
      ],
      limitations:
        'Eliminating indoor smoking is the only reliable way to prevent secondhand smoke buildup; air filtration alone is incomplete.',
      informationCategory: 'general_educational_guidance',
      sourceReference:
        'General public-health guidance consistent with WHO & US EPA Indoor Air Quality resources.',
    },
    {
      id: 'incense_and_candles',
      title: 'Incense, scented candles, and decorative burning',
      whatItIs:
        'Slow, incomplete combustion of wax, fragrances, wicks, bamboo sticks, and essential-oil diffusers or burners.',
      howItAffectsIndoorAir:
        'Burning candles or incense adds fine soot particles (PM2.5) and volatile fragrance compounds directly into enclosed rooms, often during winter when windows stay closed.',
      practicalReductionSteps: [
        'Avoid routine burning of incense or scented candles during high-pollution days or when households include young children or older adults.',
        'Use unscented, flameless LED lighting for ambiance without indoor combustion.',
      ],
      relevantPrecautions: [
        'Never leave burning candles or incense unattended or near curtains, bedding, or ventilation intakes.',
      ],
      limitations:
        'Particle output varies widely by candle composition, wick trimming, and room drafts; non-burning alternatives remove the indoor combustion source entirely.',
      informationCategory: 'general_educational_guidance',
      sourceReference:
        'General indoor particulate hygiene principles (US EPA Indoor Air Quality guidance).',
    },
    {
      id: 'cleaning_products_and_aerosols',
      title: 'Cleaning products, sprays, and household aerosols',
      whatItIs:
        'Volatile organic compounds (VOCs), ammonia, chlorine bleach, solvent sprays, air fresheners, and propellants released during routine cleaning.',
      howItAffectsIndoorAir:
        'Sprays and harsh disinfectants suspend chemical droplets and vapors at breathing height; some fragrance compounds can also react indoors to form secondary irritants.',
      practicalReductionSteps: [
        'Apply liquid cleaners onto a cloth or sponge rather than spraying mist directly into open air.',
        'Prefer plain soap, warm water, and unscented or low-VOC products for everyday dusting and surface wiping.',
        'Keep the area well ventilated while using stronger disinfectants and until surfaces dry.',
      ],
      relevantPrecautions: [
        'NEVER mix cleaning chemicals—especially chlorine bleach with ammonia, vinegar, or acidic drain/toilet cleaners—as mixing can create toxic gases.',
        'Always read and follow product warning labels and wear protective gloves where instructed.',
      ],
      limitations:
        'HEPA purifiers do not remove most chemical cleaning vapors; airing the room or reducing spray chemical intensity is necessary.',
      informationCategory: 'general_educational_guidance',
      sourceReference:
        'Household chemical safety & VOC reduction principles (US EPA & public poison-safety guidance).',
    },
    {
      id: 'poorly_maintained_combustion_appliances',
      title: 'Poorly maintained combustion appliances & heating equipment',
      whatItIs:
        'Malfunctioning, unvented, or obstructed wood/coal stoves, gas furnaces, water heaters, fireplaces, and space heaters.',
      howItAffectsIndoorAir:
        'Incomplete fuel combustion or blocked flues can leak colorless, odorless carbon monoxide (CO), nitrogen dioxide (NO2), and soot directly into living spaces.',
      practicalReductionSteps: [
        'Schedule annual qualified inspections for fuel-burning furnaces, boilers, chimneys, and flues before heavy winter use.',
        'Check that exterior furnace vents and chimney caps are unobstructed by snow, ice, or debris.',
        'Install and regularly test battery-backed carbon monoxide (CO) alarms near sleeping areas and fuel appliances.',
      ],
      relevantPrecautions: [
        'Never operate portable fuel generators, charcoal grills, or unvented kerosene/propane heaters indoors, in garages, or near open windows.',
        'If a carbon monoxide alarm sounds, move everyone outdoors immediately and contact local emergency services.',
      ],
      limitations:
        'Digital apps cannot detect carbon monoxide or gas leaks; physical certified CO alarms and qualified technician inspections are mandatory safeguards.',
      informationCategory: 'general_educational_guidance',
      sourceReference:
        'Combustion safety & indoor CO prevention principles (US EPA & national fire-safety agencies).',
    },
    {
      id: 'dust_and_resuspended_particles',
      title: 'Settled dust, pet dander & resuspended particles',
      whatItIs:
        'Soil tracked indoors on shoes, shed skin/pet dander, textile fibers, and previously settled outdoor soot stirred back into the air by footsteps or vacuuming.',
      howItAffectsIndoorAir:
        'Walking on dusty floors or dry-sweeping lifts settled coarse and fine particles back into indoor breathing zones.',
      practicalReductionSteps: [
        'Use doormats and remove outdoor shoes near the entryway to reduce tracked-in street dust.',
        'Wipe surfaces with a damp microfiber cloth and mop hard floors rather than dry-sweeping or feather-dusting.',
        'Empty vacuum canisters outdoors when possible, and clean or replace vacuum filters regularly.',
      ],
      relevantPrecautions: [
        'Resuspended dust settles again quickly; damp capture prevents particles from simply moving from floors to shelves.',
      ],
      limitations:
        'Resuspension impact varies by flooring type (carpet vs hard floor) and household foot traffic.',
      informationCategory: 'general_educational_guidance',
      sourceReference:
        'Indoor allergen & particulate reduction practices (US EPA Indoor Air Quality).',
    },
    {
      id: 'outdoor_infiltration',
      title: 'Outdoor pollution entering through windows, doors & gaps',
      whatItIs:
        'Winter particulate smog, traffic exhaust (NO2, PM2.5), or neighborhood wood smoke infiltrating indoors through open windows, leaky door seals, and unscreened vents.',
      howItAffectsIndoorAir:
        'During stagnant winter inversions, outdoor PM2.5 gradually drifts indoors even when windows are shut, raising baseline indoor particles unless filtered or mitigated when outdoor air clears.',
      practicalReductionSteps: [
        'Close street-facing windows during peak rush hours and stagnant evening smog episodes.',
        'Check low-cost door sweeps and window weatherstripping for visible drafts while keeping intentional combustion/safety vents unobstructed.',
        'Time brief airing for comparatively lower outdoor AQI intervals when forecast data supports it.',
      ],
      relevantPrecautions: [
        'Never block intentional safety vents, bathroom/kitchen exhaust paths, or fuel appliance air intakes when reducing window drafts.',
      ],
      limitations:
        'Outdoor AQI cannot predict exact indoor infiltration ratios without a physical indoor monitor; older buildings and frequent door opening let in more outdoor air.',
      informationCategory: 'general_educational_guidance',
      sourceReference:
        'Building envelope & wildfire/winter smog infiltration guidance (US EPA / public environmental health principles).',
    },
  ];
}
