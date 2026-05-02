// Helper: when user presses Enter in a Places Autocomplete input,
// prevent form submission and select the first prediction instantly.

export function attachAutocompleteEnterFix(
  input: HTMLInputElement | null,
  onSelect: (place: google.maps.places.PlaceResult) => void,
  countryRestriction: string | string[] = "eg"
) {
  if (!input || !window.google?.maps?.places) return () => {};

  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    // Prevent parent form submission
    e.preventDefault();
    e.stopPropagation();

    // If a Google suggestion is highlighted (.pac-item-selected), let Autocomplete handle it
    const highlighted = document.querySelector(".pac-item-selected");
    if (highlighted) {
      // Simulate click on the highlighted item to force place selection
      (highlighted as HTMLElement).click();
      return;
    }

    // Otherwise pick the first available prediction
    const firstItem = document.querySelector(".pac-item");
    if (firstItem) {
      (firstItem as HTMLElement).click();
      return;
    }

    // Fallback: query AutocompleteService directly with the typed text
    const value = input.value.trim();
    if (!value) return;
    const service = new google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      {
        input: value,
        componentRestrictions: { country: countryRestriction as any },
      },
      (predictions, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !predictions ||
          predictions.length === 0
        )
          return;
        const placesService = new google.maps.places.PlacesService(
          document.createElement("div")
        );
        placesService.getDetails(
          { placeId: predictions[0].place_id, fields: ["geometry", "name", "formatted_address"] },
          (place, st) => {
            if (st === google.maps.places.PlacesServiceStatus.OK && place) {
              onSelect(place);
            }
          }
        );
      }
    );
  };

  input.addEventListener("keydown", handler, true);
  return () => input.removeEventListener("keydown", handler, true);
}
