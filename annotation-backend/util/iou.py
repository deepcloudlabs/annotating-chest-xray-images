from shapely.geometry import Polygon


def compute_iou(poly_shape1, poly_shape2):
    shape1 = Polygon(poly_shape1)
    shape2 = Polygon(poly_shape2)

    polygon_intersection = shape1.intersection(shape2).area
    polygon_union = shape1.area + shape2.area - polygon_intersection
    return polygon_intersection / polygon_union
