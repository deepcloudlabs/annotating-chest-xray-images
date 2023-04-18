from shapely.geometry import Polygon


def compute_iou(poly_shape1, poly_shape2):
    shape1 = Polygon(poly_shape1)
    shape2 = Polygon(poly_shape2)

    polygon_intersection = shape1.intersection(shape2).area
    polygon_union = shape1.area + shape2.area - polygon_intersection
    return polygon_intersection / polygon_union


def linear_scale(x, x_min, x_max, y_min, y_max):
    """
    Linearly scales a value x from the range [x_min, x_max] to the range [y_min, y_max].
    """
    return round((x - x_min) / (x_max - x_min) * (y_max - y_min) + y_min)