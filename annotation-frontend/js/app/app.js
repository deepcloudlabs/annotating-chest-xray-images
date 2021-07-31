let annotationViewModel = new AnnotationViewModel();

$(document).ready(() => {
    console.log("View Model is initialized");
    toastr.options = AppConfig.TOASTR_CONFIG;
    ko.applyBindings(annotationViewModel);
});